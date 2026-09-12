"use client";

import {
  CopilotChat,
  CopilotChatConfigurationProvider,
} from "@copilotkit/react-core/v2";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <CopilotChatConfigurationProvider agentId="default">
      <main className={styles.page}>
        <section className={styles.chatShell} aria-label="AI chat">
          <div className={styles.chat}>
            <CopilotChat
              attachments={{ enabled: true }}
              input={{ disclaimer: () => null, className: "pb-6" }}
              labels={{
                welcomeMessageText:
                  "Ask a question, attach an image, or ask what skills I can use.",
                chatInputPlaceholder:
                  "Ask anything, or attach an image...",
              }}
            />
          </div>
          <p className={styles.poweredBy}>Powered by CopilotKit</p>
        </section>
      </main>
    </CopilotChatConfigurationProvider>
  );
}
