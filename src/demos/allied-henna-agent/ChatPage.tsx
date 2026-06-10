import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CustomFormPageProps } from '../../types/demo';
import { getProcessDefinitionKey, startProcessInstance } from '../../api/processApi';
import { useChatLoop } from '../../hooks/useChatLoop';
import './ChatPage.css';

const CHAT_CONFIG = {
  taskDefinitionId: 'DisplayAnswerToUser',
  answerVariable: 'answertoUser',
  replyVariable: 'followupQuestion',
};

function Header({ title }: { title: string }) {
  return (
    <header className="ahc-header">
      <img src="/logos/allied-henna-agent.svg" alt="Allied Henna" className="ahc-header-logo" />
      <span className="ahc-header-title">{title}</span>
      <Link to="/" className="ahc-header-back">← Hub</Link>
    </header>
  );
}

function ChatInterface({
  processInstanceKey,
  initialQuestion,
}: {
  processInstanceKey: string;
  initialQuestion: string;
}) {
  const { messages, status, sendReply, error } = useChatLoop(processInstanceKey, CHAT_CONFIG);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || status !== 'agent-replied') return;
    setDraft('');
    await sendReply(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = status === 'agent-replied' && draft.trim().length > 0;
  const inputDisabled = status !== 'agent-replied';

  return (
    <div className="ahc-chat">
      <div className="ahc-messages">
        <div className="ahc-bubble ahc-bubble--user">
          <div className="ahc-bubble-label">You</div>
          <div className="ahc-bubble-body">{initialQuestion}</div>
        </div>
        {messages.map((msg, i) => (
          <div key={i} className={`ahc-bubble ahc-bubble--${msg.role}`}>
            <div className="ahc-bubble-label">
              {msg.role === 'agent' ? 'Allied Henna Agent' : 'You'}
            </div>
            <div className="ahc-bubble-body">
              {msg.role === 'agent' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {(status === 'polling' || status === 'sending') && (
          <div className="ahc-bubble ahc-bubble--agent">
            <div className="ahc-bubble-label">Allied Henna Agent</div>
            <div className="ahc-bubble-body">
              <div className="ahc-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {status === 'ended' && (
          <div className="ahc-ended">
            This consultation session has ended. Thank you for contacting Allied Henna.
          </div>
        )}

        {status === 'error' && error && (
          <div className="ahc-chat-error">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {status !== 'ended' && (
        <div className="ahc-input-row">
          <textarea
            className="ahc-textarea"
            placeholder={inputDisabled ? 'Waiting for the agent…' : 'Type your message… (Enter to send)'}
            value={draft}
            rows={2}
            disabled={inputDisabled}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="ahc-send-btn" onClick={handleSend} disabled={!canSend}>
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatPage({ config }: CustomFormPageProps) {
  const [processInstanceKey, setProcessInstanceKey] = useState<string | null>(null);
  const [initialQuestion, setInitialQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startChat = async () => {
    const question = initialQuestion.trim();
    if (!question) return;
    setStarting(true);
    setStartError(null);
    try {
      const defKey = await getProcessDefinitionKey(config.processId);
      const instance = await startProcessInstance(defKey, {
        ...config.staticVariables,
        questionFromUser: question,
      });
      setSubmittedQuestion(question);
      setProcessInstanceKey(instance.processInstanceKey);
    } catch (e) {
      setStartError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      startChat();
    }
  };

  return (
    <div className="ahc-page">
      <Header title={config.title} />
      {processInstanceKey ? (
        <ChatInterface processInstanceKey={processInstanceKey} initialQuestion={submittedQuestion} />
      ) : (
        <div className="ahc-start">
          <img src="/logos/allied-henna-agent.svg" alt="Allied Henna" className="ahc-start-logo" />
          <h2 className="ahc-start-title">Allied Henna AI Agent</h2>
          <p className="ahc-start-desc">{config.description}</p>
          <textarea
            className="ahc-start-textarea"
            placeholder="What can I help you with today?"
            value={initialQuestion}
            rows={3}
            onChange={e => setInitialQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={starting}
          />
          {startError && <div className="ahc-start-error">{startError}</div>}
          <button
            className="ahc-start-btn"
            onClick={startChat}
            disabled={starting || !initialQuestion.trim()}
          >
            {starting ? 'Starting…' : 'Begin Consultation'}
          </button>
        </div>
      )}
    </div>
  );
}
