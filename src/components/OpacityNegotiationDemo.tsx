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
        y: rect.top   + window.scrollY - 4,
        });
        setShowBtn(true);
    }

    /* ③ 드래그가 끝날 때 호출 ---------------------------------- */
    function handleMouseUp() {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode))
        showButton(sel);
        else
        setShowBtn(false);
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
  // show floating button when user selects text
  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setShowBtn(false);
      return;
    }
    // only show inside editor
    if (!editorRef.current || !editorRef.current.contains(sel.anchorNode)) {
      setShowBtn(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setBtnPos({ x: rect.right + window.scrollX, y: rect.bottom + window.scrollY });
    setShowBtn(true);
  };

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

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
        const OPACITY_STEP  = 0.05;                // TODO: 증가폭
        const newOpacity = Math.min(1,
                                    OPACITY_START + edit * OPACITY_STEP);

        /* ③ 실제 적용 -------------------------------------- */
        (span as HTMLElement).style.opacity = newOpacity.toString();
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-gray-800 dark:text-white">✨ In‑place Opacity Negotiation Demo v4</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                • 텍스트를 드래그하면 <strong>AI 증강</strong> 버튼이 뜹니다.<br />
                • 삽입된 회색 AI 문장은 편집할수록 진해집니다(0.05씩).<br />
                • AI 문장 안을 다시 드래그해 증강하면, 새 회색 레이어가 추가됩니다.
            </p>
            <div
                ref={editorRef}
                contentEditable
                onMouseUp={handleMouseUp}
                className="min-h-[220px] w-full p-5 
                         bg-white dark:bg-gray-800 
                         border-2 border-gray-200 dark:border-gray-700
                         rounded-lg shadow-inner
                         focus:border-blue-400 dark:focus:border-blue-500 
                         focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
                         hover:border-gray-300 dark:hover:border-gray-600
                         transition-all duration-200"
                suppressContentEditableWarning
                onInput={handleInput}
                style={{
                    outline: 'none',
                    fontSize: '1rem',
                    lineHeight: '1.8',
                    whiteSpace: 'pre-wrap',
                    overflowY: 'auto',
                }}
            >
                오늘 아침, 나는 중요한 발표를 준비하며 극도의 긴장감을 느꼈다. 하지만 결국 무사히 발표를 마쳤다.
            </div>

            {showBtn && (
                <button
                    style={{ top: btnPos.y + 6, left: btnPos.x + 6 }}
                    className="fixed px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 
                             text-white text-sm font-medium rounded-lg shadow-lg 
                             hover:from-indigo-600 hover:to-purple-700 
                             focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                             transform hover:scale-105 transition-all duration-200"
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
