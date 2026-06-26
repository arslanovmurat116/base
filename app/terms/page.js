import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Terms | BOSE"
};

export default async function TermsPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">BOSE</p>
          <h1>{isRu ? "Условия использования" : "Terms of Use"}</h1>
        </div>
        <div className="prose">
          <p>
            {isRu
              ? "BOSE предоставляется как Telegram-first рабочая система для бизнеса. Используя Mini App и бота, вы соглашаетесь работать с сервисом в рамках его текущей функциональности."
              : "BOSE is provided as a Telegram-first operating system for businesses. By using the Mini App and the bot, you agree to use the service within its current feature set."}
          </p>
          <p>
            {isRu
              ? "Пользователь отвечает за корректность введённых данных, права на подключаемые Telegram-аккаунты и законность операций внутри своего рабочего пространства."
              : "The user is responsible for the correctness of submitted data, the rights to connected Telegram accounts, and the legality of operations inside the workspace."}
          </p>
        </div>
      </section>
    </main>
  );
}
