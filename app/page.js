import Link from "next/link";
import { getAppointmentsData, getLeadsData } from "../lib/server-data";
import { getLocale, pick } from "../lib/i18n";
import { getLanguage } from "../lib/i18n-server";

const OPEN_BOT_HREF = "https://t.me/mebel_rdn_bot";

function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function ProductCard({ title, text, href, hrefLabel }) {
  return (
    <article className="panel proof-card">
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="ghost-link" href={href}>
        {hrefLabel}
      </Link>
    </article>
  );
}

export default async function HomePage() {
  const lang = await getLanguage();
  const locale = getLocale(lang);
  const [appointments, leads] = await Promise.all([getAppointmentsData(), getLeadsData()]);

  const activeDeals = leads.filter((lead) => !["WON", "LOST"].includes(String(lead.status))).length;
  const estimateQueue = leads.filter((lead) =>
    ["QUALIFIED", "PROPOSAL"].includes(String(lead.status))
  ).length;
  const todayVisits = appointments.filter((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(String(item.status))
  ).length;
  const paymentFocus = leads.filter((lead) => {
    const stage = String(lead.dealStage || "").toLowerCase();
    const payment = String(lead.prepaymentStatus || "").toLowerCase();
    return stage.includes("deposit") || stage.includes("предоплат") || payment.includes("wait");
  }).length;

  return (
    <main className="page-shell landing-shell">
      <section className="hero-panel product-hero">
        <div className="hero-copy">
          <p className="eyebrow">{pick(lang, "AI CRM for furniture teams", "AI CRM для мебельной команды")}</p>
          <h1>
            {pick(
              lang,
              "Furneq keeps sales, estimates and workshop flow in one place.",
              "Furneq держит продажи, сметы и работу цеха в одной системе."
            )}
          </h1>
          <p className="hero-text">
            {pick(
              lang,
              "The system receives leads, helps the manager respond faster, moves the client to measurement and deposit, and keeps project files, estimates, production and installation together.",
              "Система принимает заявки, помогает менеджеру отвечать быстрее, доводит клиента до замера и предоплаты и держит проект, смету, производство и установку вместе."
            )}
          </p>

          <div className="quick-link-row">
            <a className="primary-link" href={OPEN_BOT_HREF} rel="noreferrer" target="_blank">
              {pick(lang, "Open bot", "Открыть бота")}
            </a>
            <Link className="ghost-link" href="/leads">
              {pick(lang, "Open deals", "Открыть сделки")}
            </Link>
            <Link className="ghost-link" href="/workboard">
              {pick(lang, "Open workboard", "Открыть смену")}
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label={pick(lang, "Active deals", "Активные сделки")}
          value={new Intl.NumberFormat(locale).format(activeDeals)}
          note={pick(lang, "Orders currently moving in the pipeline.", "Заказы, которые сейчас двигаются по воронке.")}
        />
        <StatCard
          label={pick(lang, "Estimate queue", "Очередь на расчёт")}
          value={new Intl.NumberFormat(locale).format(estimateQueue)}
          note={pick(lang, "Deals that need pricing or quote follow-up.", "Сделки, где нужен расчёт или возврат по КП.")}
        />
        <StatCard
          label={pick(lang, "Visits today", "Выезды на сегодня")}
          value={new Intl.NumberFormat(locale).format(todayVisits)}
          note={pick(lang, "Measurements, consultations and showroom visits.", "Замеры, консультации и встречи на сегодня.")}
        />
        <StatCard
          label={pick(lang, "Payment focus", "Фокус на оплате")}
          value={new Intl.NumberFormat(locale).format(paymentFocus)}
          note={pick(lang, "Deals that should move to deposit.", "Сделки, которые нужно дожать до предоплаты.")}
        />
      </section>

      <section className="dashboard-grid">
        <ProductCard
          title={pick(lang, "Deals", "Сделки")}
          text={pick(
            lang,
            "One clean order card with the client, budget, next step, estimate and production status.",
            "Одна чистая карточка заказа: клиент, бюджет, следующий шаг, смета и статус производства."
          )}
          href="/leads/l-202"
          hrefLabel={pick(lang, "Open deal", "Открыть сделку")}
        />
        <ProductCard
          title={pick(lang, "Workboard", "Смена")}
          text={pick(
            lang,
            "A daily queue for managers: new leads, estimates, follow-ups, visits and urgent signals.",
            "Ежедневная очередь менеджера: новые заявки, расчёты, возвраты, выезды и срочные сигналы."
          )}
          href="/workboard"
          hrefLabel={pick(lang, "Open workboard", "Открыть смену")}
        />
        <ProductCard
          title={pick(lang, "Appointments", "Замеры")}
          text={pick(
            lang,
            "Measurements and consultations with confirmation, result, deposit and direct links back to the deal.",
            "Замеры и консультации с подтверждением, результатом, предоплатой и прямой ссылкой в сделку."
          )}
          href="/appointments"
          hrefLabel={pick(lang, "Open appointments", "Открыть замеры")}
        />
      </section>
    </main>
  );
}
