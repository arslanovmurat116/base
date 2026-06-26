import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Privacy Policy | BOSE"
};

export default async function PrivacyPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">BOSE</p>
          <h1>{isRu ? "Политика конфиденциальности" : "Privacy Policy"}</h1>
        </div>
        <div className="prose">
          <p>
            {isRu
              ? "BOSE хранит только данные, необходимые для работы Telegram-бота, Mini App, launch analytics и бизнес-процессов рабочего пространства."
              : "BOSE stores only the data required to run the Telegram bot, the Mini App, launch analytics, and the business workflows of the workspace."}
          </p>
          <p>
            {isRu
              ? "Это может включать Telegram user id, username, язык, события запуска, сессии, заявки, клиентов, сделки и связанные сообщения."
              : "This may include Telegram user id, username, language, launch events, sessions, leads, clients, deals, and related messages."}
          </p>
          <p>
            {isRu
              ? "Данные используются для работы продукта, поддержки пользователей, аналитики удержания и улучшения сервиса."
              : "The data is used to operate the product, support users, analyze retention, and improve the service."}
          </p>
        </div>
      </section>
    </main>
  );
}
