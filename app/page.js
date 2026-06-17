import Link from "next/link";
import {
  getAppointmentsData,
  getDashboardData,
  getLeadsData
} from "../lib/server-data";

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

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function ValueCard({ title, text, tone }) {
  return (
    <article className={`panel value-card ${tone || ""}`.trim()}>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function PlanCard({ name, price, note, accent, features, ctaLabel, ctaHref, external = false }) {
  const cardClass = `panel plan-card ${accent ? "plan-card-accent" : ""}`.trim();
  const cta = external ? (
    <a className={accent ? "primary-link" : "ghost-link"} href={ctaHref} target="_blank" rel="noreferrer">
      {ctaLabel}
    </a>
  ) : (
    <Link className={accent ? "primary-link" : "ghost-link"} href={ctaHref}>
      {ctaLabel}
    </Link>
  );

  return (
    <article className={cardClass}>
      <p className="eyebrow">{name}</p>
      <strong className="plan-price">{price}</strong>
      <p className="plan-note">{note}</p>
      <div className="plan-feature-list">
        {features.map((feature) => (
          <span key={feature} className="plan-feature">
            {feature}
          </span>
        ))}
      </div>
      <div className="plan-card-action">{cta}</div>
    </article>
  );
}

function ProofCard({ title, text, href, hrefLabel }) {
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

function RoadmapCard({ step, title, text }) {
  return (
    <article className="panel roadmap-card">
      <span className="roadmap-step">{step}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export default async function HomePage() {
  const [dashboard, appointments, leads] = await Promise.all([
    getDashboardData(),
    getAppointmentsData(),
    getLeadsData()
  ]);

  const activeDeals = leads.filter((lead) => !["WON", "LOST"].includes(String(lead.status))).length;
  const todayAppointments = appointments.filter((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(String(item.status))
  ).length;
  const estimateBacklog = leads.filter((lead) =>
    ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(String(lead.status))
  ).length;
  const prepaymentFocus = leads.filter((lead) =>
    String(lead.prepaymentStatus || "").toLowerCase().includes("ожида")
  ).length;

  return (
    <main className="page-shell landing-shell">
      <section className="hero-panel product-hero">
        <div className="hero-copy">
          <p className="eyebrow">Telegram Mini App</p>
          <h1>Система для мебельного цеха, которая принимает заявки, дожимает до продажи и держит цех под контролем.</h1>
          <p className="hero-text">
            Мы больше не упаковываем это как просто внутреннюю CRM. Это продаваемый Telegram-first продукт:
            бот принимает входящие, mini app ведёт клиента к замеру и предоплате, а back-office держит
            под контролем менеджера, замерщика, смету, производство и установку.
          </p>

          <div className="hero-tag-row">
            <span className="hero-tag">Заявки внутри Telegram</span>
            <span className="hero-tag">Дожим до предоплаты</span>
            <span className="hero-tag">Контроль работы цеха</span>
            <span className="hero-tag">Подписка и платные функции</span>
          </div>

          <div className="quick-link-row">
            <a className="primary-link" href={OPEN_BOT_HREF} target="_blank" rel="noreferrer">
              Открыть бота
            </a>
            <Link className="ghost-link" href="/workboard">
              Смотреть демо-контуру
            </Link>
            <Link className="ghost-link" href="/leads">
              Открыть сделки
            </Link>
          </div>
        </div>

        <div className="hero-aside product-hero-aside">
          <article className="hero-kpi-card">
            <p className="eyebrow">Что продаём</p>
            <strong>Не CRM-экран</strong>
            <p>
              Продаём систему роста для мебельного бизнеса: принять заявку, проконсультировать,
              не потерять клиента, дожать до денег и не утонуть в хаосе цеха.
            </p>
          </article>
          <article className="hero-kpi-card">
            <p className="eyebrow">Монетизация</p>
            <strong>Подписка + доп. функции</strong>
            <p>
              Базовые планы по подписке, отдельные апгрейды на дожим, проектные файлы,
              контроль оплат, роли и производственный контур.
            </p>
          </article>
          <article className="hero-kpi-card">
            <p className="eyebrow">Первый рынок</p>
            <strong>Мебельные цеха и студии</strong>
            <p>
              Малые и средние команды, у которых заявки уже есть, но теряются деньги между
              консультацией, расчётом, замером, предоплатой и установкой.
            </p>
          </article>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Демо-контур"
          value={activeDeals}
          note="Сделок уже живут в текущем demo-слое и показывают реальную мебельную воронку."
        />
        <StatCard
          label="Фокус на расчётах"
          value={estimateBacklog}
          note="Клиенты, которых уже можно вести к смете, КП и согласованию."
        />
        <StatCard
          label="Замеры и встречи"
          value={todayAppointments}
          note="Контур замеров уже готов как доказательство, что это не только маркетинг."
        />
        <StatCard
          label="Дожим до денег"
          value={prepaymentFocus}
          note="Сделки, где ценность продукта видна напрямую: не упустить предоплату."
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <SectionTitle
            eyebrow="Ценность"
            title="Что должен уметь продукт, за который платят каждый месяц"
            text="Нам нужен не набор красивых экранов, а система, которая сама двигает клиента и дисциплинирует команду."
          />
          <div className="value-grid">
            <ValueCard
              title="Принимает заявки"
              text="Бот и mini app встречают входящий контакт внутри Telegram, фиксируют источник, создают карточку и не дают лиду потеряться."
              tone="value-card-accent"
            />
            <ValueCard
              title="Консультирует и дожимает"
              text="Менеджер получает короткие сценарии, ответы и контрольные точки, а клиент идёт к расчёту, замеру и предоплате."
            />
            <ValueCard
              title="Контролирует цех"
              text="После замера система ведёт проект, смету, оплату, производство, установку и даёт директору контроль в Telegram."
            />
          </div>
        </section>

        <section className="panel">
          <SectionTitle
            eyebrow="MVP продажи"
            title="Что показываем первым клиентам"
            text="Сейчас нам нужен не идеальный продукт на все времена, а жёсткий продающий контур, который быстро объясняет ценность."
          />
          <div className="proof-grid">
            <ProofCard
              title="Бот как вход"
              text="Регистрация роли, ответы по ключевым словам, быстрые ссылки на сделки и контрольные сообщения уже есть."
              href="/workboard"
              hrefLabel="Открыть смену"
            />
            <ProofCard
              title="Сделка как центр работы"
              text="Карточка сделки уже держит клиента, смету, проектные файлы, оплату, замер и производство в одном месте."
              href="/leads/l-202"
              hrefLabel="Открыть демо-сделку"
            />
            <ProofCard
              title="Проект и смета"
              text="Мы уже можем показывать превью проекта, файлы, смету и связку с follow-up без внешней таблицы."
              href="/leads/l-202#deal-project-files"
              hrefLabel="Открыть проектный блок"
            />
          </div>
        </section>
      </section>

      <section className="panel">
        <SectionTitle
          eyebrow="Тарифы"
          title="Как превращаем продукт в подписку"
          text="Наша модель должна быть простой для продажи: понятный старт, понятный апгрейд, понятные доп. деньги за расширение."
        />
        <div className="plan-grid">
          <PlanCard
            name="Старт"
            price="79 000 ₸ / мес"
            note="Для небольшого цеха, который хочет не терять входящие и держать воронку в Telegram."
            features={[
              "Бот заявок",
              "Карточки клиентов и сделок",
              "Замеры и follow-up",
              "Базовые Telegram-уведомления"
            ]}
            ctaLabel="Смотреть демо"
            ctaHref="/leads"
          />
          <PlanCard
            name="Рост"
            price="149 000 ₸ / мес"
            note="Для команды, которая хочет дожимать до предоплаты, видеть проектные файлы и контролировать оплату."
            accent
            features={[
              "Всё из Старт",
              "Проект, смета и файлы",
              "Контроль оплат",
              "Менеджерские сценарии дожима"
            ]}
            ctaLabel="Открыть бота"
            ctaHref={OPEN_BOT_HREF}
            external
          />
          <PlanCard
            name="Цех"
            price="249 000 ₸ / мес"
            note="Для тех, кому уже нужен полный контур: директор, менеджер, замерщик, производство и установка."
            features={[
              "Всё из Рост",
              "Производственный контур",
              "Роли и контроль команды",
              "Директорские сводки и отчёты"
            ]}
            ctaLabel="Открыть демо-контуру"
            ctaHref="/appointments"
          />
        </div>

        <div className="addon-strip">
          <span className="hero-tag">Подключаемые функции</span>
          <span className="hero-tag">Автодожим в Telegram</span>
          <span className="hero-tag">Файлы проекта и смета</span>
          <span className="hero-tag">Производство и установка</span>
          <span className="hero-tag">White-label для студий</span>
        </div>
      </section>

      <section className="panel">
        <SectionTitle
          eyebrow="Первые деньги"
          title="Как выходим к первой продаже"
          text="Я бы не гнался сейчас за идеальным масштабированием. Нам нужна одна жёсткая цепочка: продукт, демо, оффер, первый клиент, потом повторяем."
        />
        <div className="roadmap-grid">
          <RoadmapCard
            step="01"
            title="Переупаковать вход"
            text="Главная страница, бот и демо должны объяснять, что это Telegram-система роста для мебельного бизнеса, а не внутренняя админка."
          />
          <RoadmapCard
            step="02"
            title="Продать пилот"
            text="Первый оффер не коробка на все времена, а пилот: подключение, запуск, обучение, первые заявки и контроль дожима."
          />
          <RoadmapCard
            step="03"
            title="Перевести в подписку"
            text="После пилота клиент переходит на план Старт / Рост / Цех, а мы продаём апгрейды по ролям, автоматике и контролю производства."
          />
        </div>
      </section>
    </main>
  );
}
