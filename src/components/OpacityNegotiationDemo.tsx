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
    try {
        console.log('🌐 API 호출 시작');
        // Vercel 배포 환경에서는 /api/augment로 요청
        const apiUrl = process.env.NODE_ENV === 'production' 
            ? '/api/augment'  // Vercel 배포 환경
            : 'http://localhost:3000/augment';  // 로컬 개발 환경

        console.log('📡 API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                context: selected,
                before: before,
                after: after,
            }),
        });
        
        if (!res.ok) {
            console.error('❌ API 응답 에러:', res.status, res.statusText);
            throw new Error(`API ${res.status}: ${res.statusText}`);
        }
        
        const { text } = await res.json();
        console.log('✅ API 응답 성공:', text);
        const uniqueId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return ` <span data-ai="true" data-id="${uniqueId}" style="opacity:0.35">${text}</span>`;
    } catch (error) {
        console.error('❌ API 호출 실패:', error);
        throw error;
    }
}

  // insert AI span directly after current selection
  const augment = async () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    
    console.log('✨ Starting augmentation');
    const range = sel.getRangeAt(0);
    range.collapse(false);
    
    const fullText = editorRef.current!.innerText;
    const { startOffset, endOffset } = range;
    const before = fullText.slice(Math.max(0, startOffset - 100), startOffset);
    const after = fullText.slice(endOffset, endOffset + 100);
    const selected = window.getSelection()!.toString();
    
    console.log('📝 Selected text:', selected);
    
    const aiHtml = await fetchAug(selected, before, after);
    console.log('🤖 AI response:', aiHtml);
    
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
    console.log('📝 Input event triggered');
    
    const currentText = e.currentTarget.textContent || '';
    setText(currentText);
    setIsEmpty(currentText.trim() === '');

    // 현재 선택된 AI 생성 문장 찾기
    const sel = window.getSelection();
    if (!sel) return;

    let selectedSpan: HTMLElement | null = null;
    
    // 1. 선택 영역이 있는 경우
    if (!sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      console.log('🔍 Selection range:', range.toString());

      // 선택 영역의 시작점이 있는 AI 생성 문장 찾기
      let node: Node | null = range.startContainer;
      while (node && node !== editorRef.current) {
        if (node instanceof HTMLElement && node.hasAttribute('data-ai')) {
          selectedSpan = node;
          console.log('✅ Found AI span in selection:', node.getAttribute('data-id'));
          break;
        }
        node = node.parentElement;
      }

      // 선택 영역의 끝점이 있는 AI 생성 문장 찾기
      if (!selectedSpan) {
        node = range.endContainer;
        while (node && node !== editorRef.current) {
          if (node instanceof HTMLElement && node.hasAttribute('data-ai')) {
            selectedSpan = node;
            console.log('✅ Found AI span in selection:', node.getAttribute('data-id'));
            break;
          }
          node = node.parentElement;
        }
      }
    } 
    // 2. 선택 영역이 없는 경우 (커서만 있는 경우)
    else {
      const range = sel.getRangeAt(0);
      let node: Node | null = range.startContainer;
      
      // 커서가 있는 노드에서 시작해서 부모 노드를 따라 올라가며 AI 생성 문장 찾기
      while (node && node !== editorRef.current) {
        if (node instanceof HTMLElement && node.hasAttribute('data-ai')) {
          selectedSpan = node;
          console.log('✅ Found AI span at cursor:', node.getAttribute('data-id'));
          break;
        }
        node = node.parentElement;
      }
    }

    if (selectedSpan) {
      console.log('📝 Found AI span:', selectedSpan.getAttribute('data-id'));
      console.log('📝 Current opacity:', selectedSpan.style.opacity);
      
      // 편집 횟수 증가 및 투명도 업데이트
      const edit = Number(selectedSpan.getAttribute("data-edit") || "0") + 1;
      selectedSpan.setAttribute("data-edit", String(edit));

      const OPACITY_START = 0.35;
      const OPACITY_STEP  = 0.015;
      const newOpacity = Math.min(1, OPACITY_START + edit * OPACITY_STEP);

      console.log(`🎨 Updating opacity for span ${selectedSpan.getAttribute('data-id')}: ${newOpacity}`);
      selectedSpan.style.opacity = newOpacity.toString();
      console.log('📝 New opacity:', selectedSpan.style.opacity);
    } else {
      console.log('ℹ️ No AI span found at current position');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 md:px-8">
        <div className="w-full max-w-6xl p-8 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">✨ In‑place LLM-generated Text Negotiation Demo</h2>
            <p className="mb-6 text-base text-gray-600">
                • 텍스트를 드래그하면 <strong>AI 증강</strong> 버튼이 뜹니다.<br />
                • AI 문장은 연하게 삽입되며, 편집할수록 진해집니다.<br />
                • AI 문장 안을 다시 드래그해 증강하면 더 연해집니다.
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
                요즘은 시간을 어떻게 써야 할지 자주 고민하게 된다. 해야 할 일은 분명 있는데, 막상 집중이 잘 안 될 때가 많다. 그럴 때마다 '내가 지금 잘하고 있는 걸까' 하는 생각이 든다. 꼭 답을 찾지 않아도 괜찮다고는 하지만, 가끔은 방향이 있었으면 좋겠다.
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
