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

function SalesCard({ title, text }) {
  return (
    <article className="panel sales-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function StepCard({ index, title, text }) {
  return (
    <article className="panel demo-step-card">
      <span className="demo-step-index">{index}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function OfferCard({ title, text, features, href, hrefLabel, accent = false }) {
  return (
    <article className={`panel offer-card${accent ? " offer-card-accent" : ""}`}>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="offer-feature-list">
        {features.map((feature) => (
          <span className="offer-feature" key={feature}>
            {feature}
          </span>
        ))}
      </div>
      <Link className="ghost-link offer-card-action" href={href}>
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
    return (
      stage.includes("deposit") ||
      stage.includes("предоплат") ||
      payment.includes("wait") ||
      payment.includes("ожида")
    );
  }).length;

  const heroProof = [
    pick(lang, "Client request in Telegram", "Заявка клиента прямо в Telegram"),
    pick(lang, "CRM card for the manager", "Карточка сделки сразу в CRM"),
    pick(lang, "Estimate, deposit and workshop control", "Расчёт, предоплата и контроль цеха")
  ];

  const salesCards = [
    {
      title: pick(lang, "Clients stay in Telegram", "Клиент остаётся в Telegram"),
      text: pick(
        lang,
        "The client leaves a request, checks order status, confirms a measurement and asks for an estimate without leaving the messenger.",
        "Клиент оставляет заявку, смотрит статус заказа, подтверждает замер и запрашивает расчёт, не выходя из мессенджера."
      )
    },
    {
      title: pick(lang, "The manager gets one clean card", "Менеджер получает одну чистую карточку"),
      text: pick(
        lang,
        "The CRM keeps the lead, next step, estimate, project files, payment focus and workshop status in one order card.",
        "CRM держит лид, следующий шаг, смету, проектные файлы, оплату и статус цеха в одной карточке заказа."
      )
    },
    {
      title: pick(lang, "The owner sees real control", "Собственник видит реальный контроль"),
      text: pick(
        lang,
        "The bot and workboard show who must call back, what is waiting for estimate, what measurement is confirmed and where money is stuck.",
        "Бот и смена показывают, кому надо перезвонить, что ждёт расчёта, какой замер подтверждён и где зависли деньги."
      )
    }
  ];

  const demoSteps = [
    {
      title: pick(lang, "Client starts in the bot", "Клиент заходит в бота"),
      text: pick(
        lang,
        "A client leaves a request for a kitchen, wardrobe or custom furniture in one short flow.",
        "Клиент оставляет заявку на кухню, шкаф или другой заказ в одном коротком сценарии."
      )
    },
    {
      title: pick(lang, "CRM creates the deal", "CRM создаёт сделку"),
      text: pick(
        lang,
        "The request becomes a deal with client data, product type, next action and a direct CRM link.",
        "Заявка превращается в сделку с данными клиента, типом изделия, следующим шагом и прямой ссылкой в CRM."
      )
    },
    {
      title: pick(lang, "Team gets notified", "Команда получает сигнал"),
      text: pick(
        lang,
        "The manager and director receive an internal alert in Telegram and open the right card from the message.",
        "Менеджер и директор получают внутренний сигнал в Telegram и открывают нужную карточку прямо из сообщения."
      )
    },
    {
      title: pick(lang, "Workshop moves to estimate and production", "Цех двигает к расчёту и производству"),
      text: pick(
        lang,
        "Measurement, estimate, prepayment, production notes and installation stay in one operational loop.",
        "Замер, расчёт, предоплата, комментарии производства и установка живут в одном рабочем контуре."
      )
    }
  ];

  const offerCards = [
    {
      title: pick(lang, "Pilot for one furniture workshop", "Пилот для одного мебельного цеха"),
      text: pick(
        lang,
        "The fastest way to show value: one bot, one CRM, one team flow and a live demo on real requests.",
        "Самый быстрый путь показать ценность: один бот, одна CRM, один рабочий контур и живое демо на реальных заявках."
      ),
      features: [
        pick(lang, "Telegram client intake", "Клиентские заявки в Telegram"),
        pick(lang, "Employee bot mode", "Внутренний режим для сотрудников"),
        pick(lang, "Deals, visits and follow-ups", "Сделки, замеры и возвраты"),
        pick(lang, "Estimate and project files", "Смета и проектные файлы")
      ],
      href: "/leads/l-202",
      hrefLabel: pick(lang, "Open sample deal", "Открыть пример сделки"),
      accent: true
    },
    {
      title: pick(lang, "What the client sees", "Что видит клиент"),
      text: pick(
        lang,
        "A simple bot menu: leave request, check order status, confirm measurement, receive estimate and ask the manager to call back.",
        "Простое меню в боте: оставить заявку, посмотреть статус заказа, подтвердить замер, получить расчёт и позвать менеджера."
      ),
      features: [
        pick(lang, "Fast request flow", "Быстрый сценарий заявки"),
        pick(lang, "Order status", "Статус заказа"),
        pick(lang, "Measurement confirmation", "Подтверждение замера"),
        pick(lang, "Direct Mini App link", "Прямая кнопка в Mini App")
      ],
      href: OPEN_BOT_HREF,
      hrefLabel: pick(lang, "Open bot demo", "Открыть демо в боте")
    },
    {
      title: pick(lang, "What the team sees", "Что видит команда"),
      text: pick(
        lang,
        "A manager workboard, order card, measurements, project files and payment focus without scattered chats and spreadsheets.",
        "Смена менеджера, карточка заказа, замеры, проектные файлы и фокус на оплате без раскиданных чатов и таблиц."
      ),
      features: [
        pick(lang, "Workboard", "Рабочая смена"),
        pick(lang, "Order card", "Карточка заказа"),
        pick(lang, "Estimate flow", "Контур расчёта"),
        pick(lang, "Workshop control", "Контроль цеха")
      ],
      href: "/workboard",
      hrefLabel: pick(lang, "Open team workboard", "Открыть рабочую смену")
    }
  ];

  return (
    <main className="page-shell landing-shell">
      <section className="hero-panel product-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            {pick(lang, "Telegram CRM for furniture workshops", "Telegram CRM для мебельных цехов")}
          </p>
          <h1>
            {pick(
              lang,
              "Furneq turns inbound requests into measurements, estimates and deposits.",
              "Furneq превращает входящие заявки в замеры, расчёты и предоплату."
            )}
          </h1>
          <p className="hero-text">
            {pick(
              lang,
              "One bot receives leads from clients, one CRM gives the team a clean order card, and one workboard keeps the workshop under control.",
              "Один бот принимает заявки от клиентов, одна CRM даёт команде чистую карточку заказа, а одна рабочая смена держит цех под контролем."
            )}
          </p>

          <div className="quick-link-row">
            <a className="primary-link" href={OPEN_BOT_HREF} rel="noreferrer" target="_blank">
              {pick(lang, "Open bot", "Открыть бота")}
            </a>
            <Link className="ghost-link" href="/leads/l-202">
              {pick(lang, "Open sample deal", "Открыть пример сделки")}
            </Link>
            <Link className="ghost-link" href="/workboard">
              {pick(lang, "Open workboard", "Открыть рабочую смену")}
            </Link>
          </div>

          <div className="hero-proof-row">
            {heroProof.map((item) => (
              <span className="hero-proof-item" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label={pick(lang, "Active deals", "Активные сделки")}
          value={new Intl.NumberFormat(locale).format(activeDeals)}
          note={pick(
            lang,
            "Orders currently moving in the pipeline.",
            "Заказы, которые сейчас двигаются по воронке."
          )}
        />
        <StatCard
          label={pick(lang, "Estimate queue", "Очередь на расчёт")}
          value={new Intl.NumberFormat(locale).format(estimateQueue)}
          note={pick(
            lang,
            "Deals that need pricing or quote follow-up.",
            "Сделки, где нужен расчёт или возврат по КП."
          )}
        />
        <StatCard
          label={pick(lang, "Visits today", "Выезды на сегодня")}
          value={new Intl.NumberFormat(locale).format(todayVisits)}
          note={pick(
            lang,
            "Measurements, consultations and showroom visits.",
            "Замеры, консультации и встречи на сегодня."
          )}
        />
        <StatCard
          label={pick(lang, "Payment focus", "Фокус на оплате")}
          value={new Intl.NumberFormat(locale).format(paymentFocus)}
          note={pick(
            lang,
            "Deals that should move to deposit.",
            "Сделки, которые нужно дожать до предоплаты."
          )}
        />
      </section>

      <section className="sales-grid">
        {salesCards.map((card) => (
          <SalesCard key={card.title} title={card.title} text={card.text} />
        ))}
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{pick(lang, "Demo flow", "Сценарий демо")}</p>
          <h2>
            {pick(
              lang,
              "What you show in the first sales call",
              "Что показывать на первом созвоне с цехом"
            )}
          </h2>
        </div>
        <div className="demo-step-grid">
          {demoSteps.map((step, index) => (
            <StepCard
              key={step.title}
              index={String(index + 1).padStart(2, "0")}
              title={step.title}
              text={step.text}
            />
          ))}
        </div>
      </section>

      <section className="offer-grid">
        {offerCards.map((card) => (
          <OfferCard key={card.title} {...card} />
        ))}
      </section>

      <section className="panel cta-panel">
        <div>
          <p className="eyebrow">{pick(lang, "Ready to demo", "Готово к показу")}</p>
          <h2>
            {pick(
              lang,
              "Open the bot, create a request and show how the deal appears in CRM.",
              "Открой бота, создай заявку и покажи, как сделка сразу появляется в CRM."
            )}
          </h2>
          <p>
            {pick(
              lang,
              "This is the shortest path to the first pilot: client request in Telegram, manager card in CRM, team alert and one operational loop for sales and workshop.",
              "Это самый короткий путь к первому пилоту: заявка клиента в Telegram, карточка у менеджера в CRM, сигнал команде и один рабочий контур для продаж и цеха."
            )}
          </p>
        </div>
        <div className="cta-actions">
          <a className="primary-link" href={OPEN_BOT_HREF} rel="noreferrer" target="_blank">
            {pick(lang, "Launch live bot", "Запустить живого бота")}
          </a>
          <Link className="ghost-link" href="/appointments">
            {pick(lang, "Open measurements", "Открыть замеры")}
          </Link>
        </div>
      </section>
    </main>
  );
}
