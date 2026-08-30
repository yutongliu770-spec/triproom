"use client";

import { FormEvent, useState } from "react";
import { ImagePlus, LockKeyhole, Mic, SendHorizontal } from "lucide-react";

export function ChatComposer({
  onSend,
  onShareScreenshot,
  discussionPlaceName,
  onClearDiscussionPlace,
  isProcessing
}: {
  onSend: (
    text: string,
    visibility: "group" | "ai_only",
    messageType?: "user_text" | "user_voice"
  ) => void;
  onShareScreenshot: () => void;
  discussionPlaceName?: string;
  onClearDiscussionPlace?: () => void;
  isProcessing: boolean;
}) {
  const [text, setText] = useState("");
  const [privateToAi, setPrivateToAi] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value, privateToAi ? "ai_only" : "group", voiceDraft ? "user_voice" : "user_text");
    setText("");
    setVoiceDraft(false);
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-ink/10 bg-white p-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2 pb-3">
          <button
            type="button"
            className="focus-ring grid size-9 place-items-center rounded-full bg-cloud text-ink/70"
            title="上传截图或图片"
            aria-label="上传截图或图片"
            onClick={onShareScreenshot}
          >
            <ImagePlus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="focus-ring grid size-9 place-items-center rounded-full bg-cloud text-ink/70"
            title="语音输入"
            aria-label="语音输入"
            onClick={() => {
              setText("海边和电车我挺喜欢，不过如果专门花一天过去感觉有点久。");
              setVoiceDraft(true);
            }}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`focus-ring inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
              privateToAi ? "bg-ink text-paper" : "bg-cloud text-ink/70"
            }`}
            onClick={() => setPrivateToAi((current) => !current)}
          >
            <LockKeyhole size={14} aria-hidden="true" />
            仅 AI 可见
          </button>
          {voiceDraft && <span className="text-xs text-ink/50">语音已转写，可编辑后发送</span>}
          {isProcessing && <span className="text-xs text-ink/50">AI 正在整理上下文...</span>}
        </div>
        {discussionPlaceName && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-pine/10 px-3 py-1.5 text-xs font-medium text-pine">
            正在讨论：{discussionPlaceName}
            <button
              type="button"
              className="rounded-full px-1 text-pine/65 hover:text-pine"
              onClick={onClearDiscussionPlace}
              aria-label="清除当前讨论地点"
            >
              x
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            placeholder={
              discussionPlaceName
                ? `围绕${discussionPlaceName}说一句想法`
                : "说一句想法，或直接输入：我想先看看东京"
            }
            className="focus-ring min-h-12 flex-1 resize-none rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm leading-6 text-ink placeholder:text-ink/40"
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="focus-ring grid size-12 shrink-0 place-items-center rounded-full bg-coral text-white"
            aria-label="发送"
          >
            <SendHorizontal size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
