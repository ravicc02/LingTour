/**
 * Email event registry.
 *
 * Every notification email the product sends (or plans to send) is one event.
 * Templates are customized per (event, locale) pair and stored in the
 * `email_templates` table; the definitions below are the code-owned source of
 * truth for event keys, supported variables, and the built-in fallback
 * template used when no database template exists yet.
 *
 * Status:
 * - 'active'  — a real send site already renders this event.
 * - 'planned' — the business scenario exists but no send site calls it yet.
 *               Templates stay editable so the copy is ready before the send
 *               site lands; the admin UI marks these honestly as 未接入
 *               instead of pretending they fire.
 */

export interface EmailEventVariable {
  key: string;
  label: string;
  example: string;
}

export interface EmailEventDefinition {
  key: string;
  label: string;
  description: string;
  status: 'active' | 'planned';
  variables: EmailEventVariable[];
  defaultSubject: string;
  defaultBodyHtml: string;
}

const BRAND_STYLES = {
  primary: '#236554',
  text: '#1f2933',
  muted: '#52606d',
  border: '#d5e0da',
  surface: '#f0f5f2',
  footer: '#7b8794',
  hairline: '#e4e7eb',
};

/**
 * Wraps an event body in the brand frame. The output is a complete HTML
 * document — `<!DOCTYPE>`, `<html>`, `<head>` with an explicit utf-8 charset —
 * because strict mail gateways (some corporate filters, Outlook, several
 * mainland providers) degrade a bare `<div>` fragment into unstyled text.
 * Every style stays inline: `<style>` blocks and external sheets are stripped
 * by many clients, and the plain-text alternative is derived from this markup
 * by tag-stripping, so a `<style>` block would leak CSS into it.
 */
function shell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>{{siteName}}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
<div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: ${BRAND_STYLES.text};">
  <div style="border-bottom: 2px solid ${BRAND_STYLES.primary}; padding-bottom: 16px; margin-bottom: 24px;">
    <span style="font-size: 20px; font-weight: 700; color: ${BRAND_STYLES.primary}; letter-spacing: 0.08em;">CULVOY</span>
  </div>
${bodyHtml}
  <div style="border-top: 1px solid ${BRAND_STYLES.hairline}; padding-top: 16px; margin-top: 24px; font-size: 12px; color: ${BRAND_STYLES.footer};">
    <p style="margin: 0;">{{siteName}} — Guangdong culture, story routes, and interpreting.</p>
  </div>
</div>
</body>
</html>`;
}

function codeBody(actionText: string): string {
  return `  <h1 style="font-size: 20px; margin: 0 0 16px;">Your verification code</h1>
  <p style="margin: 0 0 16px; line-height: 1.6;">Use the code below to ${actionText}:</p>
  <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: ${BRAND_STYLES.surface}; border: 1px solid ${BRAND_STYLES.border}; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 16px;">{{code}}</div>
  <p style="margin: 0 0 24px; line-height: 1.6; color: ${BRAND_STYLES.muted};">This code expires in {{minutes}} minutes. If you did not request it, you can safely ignore this email.</p>`;
}

function noticeBody(introHtml: string, rows: [string, string][]): string {
  const rowHtml = rows
    .map(
      ([label, value]) =>
        `    <tr><td style="padding: 8px 12px; color: ${BRAND_STYLES.muted}; white-space: nowrap;">${label}</td><td style="padding: 8px 12px; font-weight: 600;">${value}</td></tr>`,
    )
    .join('\n');
  return `  <h1 style="font-size: 20px; margin: 0 0 16px;">{{title}}</h1>
  <p style="margin: 0 0 20px; line-height: 1.6;">${introHtml}</p>
  <table style="width: 100%; border-collapse: collapse; background: ${BRAND_STYLES.surface}; border: 1px solid ${BRAND_STYLES.border}; border-radius: 8px; margin-bottom: 20px;">
    <tbody>
${rowHtml}
    </tbody>
  </table>
  <p style="margin: 0 0 8px; line-height: 1.6; color: ${BRAND_STYLES.muted};">If you have any questions, just reply to this email.</p>`;
}

const CODE_VARIABLES: EmailEventVariable[] = [
  { key: 'code', label: '验证码', example: '482913' },
  { key: 'minutes', label: '有效期（分钟）', example: '10' },
  { key: 'siteName', label: '站点名称', example: 'Culvoy' },
];

const ORDER_VARIABLES: EmailEventVariable[] = [
  { key: 'title', label: '标题', example: 'Order confirmed' },
  { key: 'orderNumber', label: '订单号', example: 'CV-20260918-8412' },
  { key: 'amount', label: '金额', example: '¥680.00' },
  { key: 'currency', label: '币种', example: 'CNY' },
  { key: 'siteName', label: '站点名称', example: 'Culvoy' },
];

const BOOKING_VARIABLES: EmailEventVariable[] = [
  { key: 'title', label: '标题', example: 'Booking confirmed' },
  { key: 'bookingReference', label: '预约编号', example: 'BK-20260918-0331' },
  { key: 'serviceName', label: '服务名称', example: 'Half-day Canton heritage walk' },
  { key: 'scheduledAt', label: '预约时间', example: '2026-09-20 10:00' },
  { key: 'siteName', label: '站点名称', example: 'Culvoy' },
];

const ORDER_SHIPPED_VARIABLES: EmailEventVariable[] = [
  ...ORDER_VARIABLES,
  { key: 'trackingNo', label: '物流单号', example: 'SF1234567890' },
];

const WELCOME_VARIABLES: EmailEventVariable[] = [
  { key: 'title', label: '标题', example: 'Welcome to Culvoy' },
  { key: 'name', label: '称呼', example: 'Ravi' },
  { key: 'siteName', label: '站点名称', example: 'Culvoy' },
];

const COMMUNITY_REVIEW_VARIABLES: EmailEventVariable[] = [
  { key: 'title', label: '标题', example: 'Your community post is live' },
  { key: 'postTitle', label: '帖子标题', example: 'Morning light at Shamian Island' },
  { key: 'result', label: '审核结果（Approved / Not approved）', example: 'Approved' },
  { key: 'reason', label: '审核说明', example: 'No further action is needed.' },
  { key: 'siteName', label: '站点名称', example: 'Culvoy' },
];

export const EMAIL_EVENTS: EmailEventDefinition[] = [
  {
    key: 'signup_verification',
    label: '注册验证码',
    description: '旅行者以邮箱验证码方式注册账号时发送。',
    status: 'active',
    variables: [
      ...CODE_VARIABLES,
      { key: 'action', label: '动作说明', example: 'create your Culvoy account' },
    ],
    defaultSubject: 'Your Culvoy verification code',
    defaultBodyHtml: shell(codeBody('{{action}}')),
  },
  {
    key: 'login_verification',
    label: '登录验证码',
    description: '旅行者以邮箱验证码方式登录时发送。',
    status: 'active',
    variables: [
      ...CODE_VARIABLES,
      { key: 'action', label: '动作说明', example: 'log in to Culvoy' },
    ],
    defaultSubject: 'Your Culvoy verification code',
    defaultBodyHtml: shell(codeBody('{{action}}')),
  },
  {
    key: 'email_change_verification',
    label: '换绑邮箱验证码',
    description: '已登录账号绑定新邮箱地址时的双确认验证码。',
    status: 'active',
    variables: [
      ...CODE_VARIABLES,
      {
        key: 'action',
        label: '动作说明',
        example: 'confirm your new email address',
      },
      { key: 'email', label: '新邮箱地址', example: 'traveller@example.com' },
    ],
    defaultSubject: 'Confirm your new Culvoy email address',
    defaultBodyHtml: shell(codeBody('{{action}}')),
  },
  {
    key: 'password_reset',
    label: '修改密码验证码',
    description: '找回或修改密码时的身份验证码。',
    status: 'active',
    variables: [
      ...CODE_VARIABLES,
      { key: 'action', label: '动作说明', example: 'reset your Culvoy password' },
    ],
    defaultSubject: 'Reset your Culvoy password',
    defaultBodyHtml: shell(codeBody('{{action}}')),
  },
  {
    key: 'order_created',
    label: '订单创建通知',
    description: '旅行者提交商城订单后发送的确认邮件。',
    status: 'active',
    variables: ORDER_VARIABLES,
    defaultSubject: 'Your Culvoy order {{orderNumber}}',
    defaultBodyHtml: shell(
      noticeBody('We have received your order. Payment instructions are shown on the order page.', [
        ['Order', '{{orderNumber}}'],
        ['Amount', '{{amount}}'],
        ['Currency', '{{currency}}'],
      ]),
    ),
  },
  {
    key: 'order_paid',
    label: '支付成功通知',
    description: '订单支付成功后发送的收据邮件。',
    status: 'active',
    variables: ORDER_VARIABLES,
    defaultSubject: 'Payment received — order {{orderNumber}}',
    defaultBodyHtml: shell(
      noticeBody('Thank you! Your payment went through and your order is confirmed.', [
        ['Order', '{{orderNumber}}'],
        ['Amount paid', '{{amount}}'],
        ['Currency', '{{currency}}'],
      ]),
    ),
  },
  {
    key: 'order_refunded',
    label: '退款完成通知',
    description: '售后退款完成后发送的通知邮件。',
    status: 'active',
    variables: ORDER_VARIABLES,
    defaultSubject: 'Refund completed — order {{orderNumber}}',
    defaultBodyHtml: shell(
      noticeBody('Your refund has been processed and is on its way back to your original payment method.', [
        ['Order', '{{orderNumber}}'],
        ['Refund amount', '{{amount}}'],
        ['Currency', '{{currency}}'],
      ]),
    ),
  },
  {
    key: 'order_shipped',
    label: '订单发货通知',
    description: '商城订单发货后发送的物流通知邮件。',
    status: 'active',
    variables: ORDER_SHIPPED_VARIABLES,
    defaultSubject: 'Your Culvoy order {{orderNumber}} has shipped',
    defaultBodyHtml: shell(
      noticeBody('Your order is on its way. Keep the tracking number below to follow the parcel.', [
        ['Order', '{{orderNumber}}'],
        ['Tracking number', '{{trackingNo}}'],
      ]),
    ),
  },
  {
    key: 'booking_confirmed',
    label: '预约确认通知',
    description: '口译服务预约确认后发送的通知邮件。',
    status: 'active',
    variables: BOOKING_VARIABLES,
    defaultSubject: 'Booking confirmed — {{serviceName}}',
    defaultBodyHtml: shell(
      noticeBody('Your interpreting booking is confirmed. We look forward to meeting you.', [
        ['Booking', '{{bookingReference}}'],
        ['Service', '{{serviceName}}'],
        ['When', '{{scheduledAt}}'],
      ]),
    ),
  },
  {
    key: 'welcome',
    label: '欢迎邮件',
    description: '旅行者首次注册成功时发送的欢迎邮件。',
    status: 'active',
    variables: WELCOME_VARIABLES,
    defaultSubject: 'Welcome to {{siteName}}, {{name}}',
    defaultBodyHtml: shell(
      `  <h1 style="font-size: 20px; margin: 0 0 16px;">{{title}}</h1>\n` +
        `  <p style="margin: 0 0 16px; line-height: 1.6;">Hi {{name}}, your {{siteName}} account is ready. From here you can follow story routes, book interpreting, and share field notes with other travellers.</p>\n` +
        `  <p style="margin: 0 0 8px; line-height: 1.6; color: ${BRAND_STYLES.muted};">If you have any questions, just reply to this email.</p>`,
    ),
  },
  {
    key: 'community_post_reviewed',
    label: '社区帖子审核结果',
    description: '管理员审核社区帖子后，向发帖人发送的通过 / 驳回通知。',
    status: 'active',
    variables: COMMUNITY_REVIEW_VARIABLES,
    defaultSubject: '{{title}}',
    defaultBodyHtml: shell(
      noticeBody('{{reason}}', [
        ['Post', '{{postTitle}}'],
        ['Result', '{{result}}'],
      ]),
    ),
  },
];

const EMAIL_EVENT_MAP = new Map(EMAIL_EVENTS.map((e) => [e.key, e]));

export function getEmailEvent(key: string): EmailEventDefinition | undefined {
  return EMAIL_EVENT_MAP.get(key);
}

/** Maps the auth verification purposes to their template events. */
export function purposeToEventKey(
  purpose: 'login' | 'signup' | 'change_email' | 'password_reset',
): string {
  switch (purpose) {
    case 'signup':
      return 'signup_verification';
    case 'change_email':
      return 'email_change_verification';
    case 'password_reset':
      return 'password_reset';
    case 'login':
    default:
      return 'login_verification';
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replaces `{{key}}` placeholders with HTML-escaped variable values.
 * Unknown placeholders are dropped so a stale template never leaks raw
 * `{{...}}` markers into a traveller-facing email. Variable values are
 * escaped; the template body itself is admin-authored trusted HTML.
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      return '';
    }
    return escapeHtml(String(value));
  });
}

/** Built-in example variables so admin previews render realistic content. */
export function buildPreviewVars(
  definition: EmailEventDefinition,
  overrides?: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const variable of definition.variables) {
    vars[variable.key] = variable.example;
  }
  vars.siteName = 'Culvoy';
  return { ...vars, ...(overrides ?? {}) };
}
