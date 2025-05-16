import React, { useState, useRef, useEffect } from "react";

/**
 * Prototype 4  ‑  Pure in‑place augmentation.
 * -------------------------------------------------------------
 * • 한 개의 <div contentEditable> 만 사용—별도 프리뷰 창이 없음.
 * • 사용자가 텍스트 일부를 드래그하면 떠오르는 "AI 증강" 퀵‑버튼.
 * • 클릭 시 (모의) AI 제안이 선택 영역 뒤에 <span data‑ai>…</span> 으로
 *   바로 삽입되며 opacity=0.35 로 시작.
 * • 사용자가 그 span 내부를 편집할수록 opacity 가 1.0 까지 점차 진해짐.
 *
 * ⚠️  데모 목적의 간단 로직입니다—정교한 range 계산이나 협업 편집 충돌
 *     처리는 포함하지 않습니다.
 */


export default function OpacityNegotiationDemo() {
    const editorRef = useRef<HTMLDivElement>(null);
    const [text, setText] = useState<string>('오늘 아침, 나는 중요한 발표를 준비하며 극도의 긴장감을 느꼈다. 하지만 결국 무사히 발표를 마쳤다.');
    const [isEmpty, setIsEmpty] = useState(false);

    /* ① 버튼 위치·표시 상태 ------------------------------------- */
    const btnRef  = useRef<HTMLButtonElement>(null);
    const [showBtn, setShowBtn] = useState(false);
    const [btnPos,  setBtnPos]  = useState({ x: 0, y: 0 });

    /* ② 선택 영역 옆에 버튼 배치 ------------------------------- */
    function showButton(sel: Selection) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setBtnPos({
            x: rect.right + window.scrollX + 6,
            y: rect.top + window.scrollY - 4,
        });
        setShowBtn(true);
    }

    /* ③ 드래그가 끝날 때 호출 ---------------------------------- */
    function handleMouseUp() {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
            showButton(sel);
        } else {
            setShowBtn(false);
        }
    }

  // helper: 실제 API 호출
async function fetchAug(selected: string, before: string, after: string) {
    const res = await fetch("/api/augment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: selected,          // 드래그한 부분
          before:  before,
          after:   after,
        }),
      });
    
      if (!res.ok) throw new Error(`API ${res.status}`);
      const { text } = await res.json();
      return ` <span data-ai="true" style="opacity:0.35">${text}</span>`;
  }

  // insert AI span directly after current selection
  const augment = async () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    range.collapse(false); // place cursor at end of selection
    const fullText = editorRef.current!.innerText;   // 전체 엔트리
    const { startOffset, endOffset } = range;
    const before = fullText.slice(Math.max(0, startOffset - 100), startOffset); 
    const after  = fullText.slice(endOffset, endOffset + 100);  
    const selected = window.getSelection()!.toString();
    const aiHtml   = await fetchAug(selected, before, after);
    const temp = document.createElement("div");
    temp.innerHTML = aiHtml;
    const frag = document.createDocumentFragment();
    Array.from(temp.childNodes).forEach((n) => frag.appendChild(n));
    range.insertNode(frag);
    sel.collapseToEnd();
    setShowBtn(false);
  };

  // on input, for every span[data-ai] count edits & raise opacity
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const currentText = e.currentTarget.textContent || '';
    setText(currentText);
    setIsEmpty(currentText.trim() === '');

    const spans = editorRef.current?.querySelectorAll("span[data-ai]") || [];
    spans.forEach((span) => {
        /* ① 편집 횟수 누적 ---------------------------------- */
        const edit = Number(span.getAttribute("data-edit")) + 1;
        span.setAttribute("data-edit", String(edit));

        /* ② ★투명도 계산식 수정 지점★
        ---------------------------------------------------
        newOpacity = 시작값 + (편집횟수 × 증가폭)
        - 시작값, 증가폭을 바꾸거나
        - 지수·로그식 등 다른 수식으로 교체해도 됨
        */
        const OPACITY_START = 0.35;                // TODO: 시작값
        const OPACITY_STEP  = 0.025;                // TODO: 증가폭
        const newOpacity = Math.min(1, OPACITY_START + edit * OPACITY_STEP);

        /* ③ 실제 적용 -------------------------------------- */
        (span as HTMLElement).style.opacity = newOpacity.toString();
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 md:px-8">
        <div className="w-full max-w-6xl p-8 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">✨ In‑place Opacity Negotiation Demo v4</h2>
            <p className="mb-6 text-base text-gray-600">
                • 텍스트를 드래그하면 <strong>AI 증강</strong> 버튼이 뜹니다.<br />
                • 삽입된 회색 AI 문장은 편집할수록 진해집니다(0.05씩).<br />
                • AI 문장 안을 다시 드래그해 증강하면, 새 회색 레이어가 추가됩니다.
            </p>
            <div
                ref={editorRef}
                contentEditable
                onMouseUp={handleMouseUp}
                className="editor-content w-full p-10
                         bg-white
                         border border-gray-300
                         rounded-xl
                         shadow-[0_2px_8px_rgba(0,0,0,0.08)]
                         focus:border-blue-500
                         focus:ring-1 focus:ring-blue-500
                         hover:border-gray-400
                         transition-all duration-200
                         text-[1.2rem] leading-[2]
                         min-h-[800px] max-h-[85vh]
                         outline-none
                         whitespace-pre-wrap
                         overflow-y-auto"
                suppressContentEditableWarning
                onInput={handleInput}
            >
                오늘 아침, 나는 중요한 발표를 준비하며 극도의 긴장감을 느꼈다. 하지만 결국 무사히 발표를 마쳤다.
            </div>

            {showBtn && (
                <button
                    ref={btnRef}
                    className="augment-button fixed
                             px-4 py-2 
                             bg-blue-600
                             text-white
                             text-sm font-bold rounded-lg
                             shadow-lg 
                             hover:bg-blue-700
                             focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                             transform hover:scale-105 transition-all duration-200
                             z-50"
                    style={{ 
                        top: btnPos.y + 6, 
                        left: btnPos.x + 6,
                        color: 'white',  
                        backgroundColor: '#2563eb'
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        augment();
                    }}
                >
                    AI 증강
                </button>
            )}
        </div>
    </div>
  );
}
