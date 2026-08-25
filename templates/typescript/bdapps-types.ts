/**
 * bdapps request/response types.
 *
 * Field names and optionality follow the official documentation at
 * https://dev.bdapps.com/. Note that bdapps sends numbers
 * as strings (baseSize, amount, chargeableBalance, latitude, longitude) —
 * the types reflect the wire format, not what you wish it were. Parse at the
 * boundary.
 */

/* ── Common ──────────────────────────────────────────────────────────────── */

/** Every bdapps response carries at least these. */
export interface BdappsBaseResponse {
  statusCode: string;
  statusDetail: string;
  version?: string;
  requestId?: string;
}

/** Credentials injected by the client — never build these at a call site. */
export interface BdappsCredentials {
  applicationId: string;
  password: string;
}

/**
 * A subscriber address. Always `tel:`-prefixed. May be a plain MSISDN
 * (`tel:8801812345678`) or, when number masking is enabled for the app, an
 * opaque hash (`tel:hu3b84346f…`). Treat it as opaque either way.
 */
export type TelAddress = `tel:${string}`;

/** SMS broadcast to the entire subscribed base. Guard its use. */
export const BROADCAST_ADDRESS = "tel:all" as const;

/* ── SMS ─────────────────────────────────────────────────────────────────── */

export type SmsEncoding = "0" | "240" | "245"; // Text | Flash | Binary (hex)

export interface SmsSendRequest extends BdappsCredentials {
  version?: string;
  /** Always an array, even for a single recipient. */
  destinationAddresses: string[];
  message: string;
  /** Your shortcode (e.g. "77000") or a provisioned tel: alias, or E1331. */
  sourceAddress?: string;
  /** "0" = not required, "1" = required. */
  deliveryStatusRequest?: "0" | "1";
  encoding?: SmsEncoding;
}

export interface SmsDestinationResponse {
  address?: string;
  messageId?: string;
  statusDetail?: string;
  timeStamp?: string;
}

export interface SmsSendResponse extends BdappsBaseResponse {
  messageId?: string;
  /** Per-recipient results. A multi-recipient send can partially succeed. */
  destinationResponses?: SmsDestinationResponse[];
}

/** Inbound: MO SMS — what the platform POSTs to your callback URL. */
export interface MoSmsCallback {
  version: string;
  applicationId: string;
  sourceAddress: string;
  message: string;
  requestId: string;
  encoding: SmsEncoding;
}

/**
 * Delivery status. bdapps→app uses the long forms; the underlying SMPP
 * gateway uses the abbreviated ones. Accept both and normalise on the way in.
 */
export type DeliveryStatus =
  | "DELIVERED" | "EXPIRED" | "DELETED" | "UNDELIVERABLE"
  | "ACCEPTED" | "UNKNOWN" | "REJECTED"
  | "DELIVRD" | "UNDELIV" | "ACCEPTD" | "REJECTD";

/** Inbound: delivery report. */
export interface DeliveryReportCallback {
  destinationAddress: string;
  /** 10 digits (yyMMddHHmm) or 14 (yyyyMMddHHmmss). Parse on length. */
  timeStamp: string;
  /** Matches the requestId/messageId from the original send. */
  requestId: string;
  deliveryStatus: DeliveryStatus;
}

/* ── USSD ────────────────────────────────────────────────────────────────── */

/** Set by the platform on inbound; set by your app on outbound. */
export type UssdOperation =
  | "mo-init"  // platform: subscriber started a session
  | "mo-cont"  // platform: subscriber replied
  | "mt-init"  // app: app-initiated session
  | "mt-cont"  // app: next screen, session stays open
  | "mt-fin";  // app: final screen, session closes

export interface UssdSendRequest extends BdappsCredentials {
  version?: string;
  message: string;
  /** Echo the sessionId the platform gave you. Never generate your own. */
  sessionId: string;
  ussdOperation: Extract<UssdOperation, "mt-init" | "mt-cont" | "mt-fin">;
  destinationAddress: string;
  /** "440" = plain ASCII. */
  encoding?: "440";
}

export interface UssdSendResponse extends BdappsBaseResponse {
  timeStamp?: string;
}

/** Inbound: USSD keypress or session start. */
export interface UssdReceiveCallback {
  version: string;
  applicationId: string;
  sessionId: string;
  ussdOperation: Extract<UssdOperation, "mo-init" | "mo-cont">;
  sourceAddress: string;
  vlrAddress?: string;
  message: string;
  encoding: string;
  requestId: string;
}

/* ── Subscription ────────────────────────────────────────────────────────── */

/** "1" = opt in (register), "0" = opt out (unregister). */
export type SubscriptionAction = "1" | "0";

export type SubscriptionStatus =
  | "REGISTERED" | "UNREGISTERED" | "PENDING" | "CHARGE";

export interface SubscriptionSendRequest extends BdappsCredentials {
  version?: string;
  action: SubscriptionAction;
  subscriberId: string;
}

export interface SubscriptionSendResponse extends BdappsBaseResponse {
  subscriptionStatus?: SubscriptionStatus;
}

export interface SubscriptionStatusRequest extends BdappsCredentials {
  subscriberId: string;
}

export interface SubscriptionStatusResponse extends BdappsBaseResponse {
  subscriptionStatus?: SubscriptionStatus;
}

export interface QueryBaseRequest extends BdappsCredentials {}

export interface QueryBaseResponse extends BdappsBaseResponse {
  /** Subscriber base size — arrives as a string. Coerce before arithmetic. */
  baseSize?: string;
}

/** Inbound: subscription notification. The authoritative source of state. */
export interface SubscriptionNotificationCallback {
  applicationId: string;
  subscriberId: string;
  status: "REGISTERED" | "UNREGISTERED";
  frequency?: string;
  version: string;
  timeStamp: string;
}

/* ── OTP ─────────────────────────────────────────────────────────────────── */

export type OtpClient = "MOBILEAPP" | "WebSite" | "DESKTOP";

export interface OtpApplicationMetaData {
  client: OtpClient;
  device: string;
  os: string;
  /** App: package name or store URL. Web: page URL. Desktop: download URL. */
  appCode: string;
}

export interface OtpRequestInput extends BdappsCredentials {
  subscriberId: string;
  /**
   * The hash identifying your app so the platform sends the verification SMS
   * in a form your app can read (the Android SMS Retriever app hash). A
   * per-application constant, not a per-request id.
   */
  applicationHash?: string;
  applicationMetaData?: OtpApplicationMetaData;
}

export interface OtpRequestResponse extends BdappsBaseResponse {
  /** Keep server-side, in the session. Never send to the client. */
  referenceNo?: string;
}

export interface OtpVerifyInput extends BdappsCredentials {
  referenceNo: string;
  otp: string;
}

export interface OtpVerifyResponse extends BdappsBaseResponse {
  subscriptionStatus?: SubscriptionStatus;
  /** The masked subscriberId to use for every subsequent API call. */
  subscriberId?: string;
}

/* ── CaaS ────────────────────────────────────────────────────────────────── */

export interface DirectDebitRequest extends BdappsCredentials {
  /** Your idempotency key. Persist BEFORE calling. Max 32 chars. */
  externalTrxId: string;
  subscriberId: string;
  /** Sent as a string. Hold it as a decimal type in your own code. */
  amount: string;
  paymentInstrumentName: "MobileAccount";
  accountId?: string;
  currency?: string;
}

export interface DirectDebitResponse extends BdappsBaseResponse {
  externalTrxId?: string;
  /** Payment gateway's ID. Persist it — support traces with this. */
  internalTrxId?: string;
  referenceId?: string;
  /** ISO-8601. */
  timeStamp?: string;
  shortDescription?: string;
  longDescription?: string;
}

export interface BalanceQueryRequest extends BdappsCredentials {
  subscriberId: string;
  accountId?: string;
  currency?: string;
}

export interface BalanceQueryResponse extends BdappsBaseResponse {
  /** String. Parse as decimal, never as a float you compare for equality. */
  chargeableBalance?: string;
  accountType?: string;
  accountStatus?: string;
}

