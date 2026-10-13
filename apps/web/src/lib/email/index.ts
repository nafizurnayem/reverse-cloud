import type {
  EmailContextMap,
  EmailTemplateType,
  RenderedEmail,
} from "./types";
import { renderInviteEmail } from "./templates/invite";
import { renderProjectActivatedEmail } from "./templates/project-activated";
import { renderMilestoneUpdatedEmail } from "./templates/milestone-updated";
import { renderPaymentDueEmail } from "./templates/payment-due";
import { renderDeliveredEmail } from "./templates/delivered";

export * from "./types";
export * from "./layout";
export { renderInviteEmail } from "./templates/invite";
export { renderProjectActivatedEmail } from "./templates/project-activated";
export { renderMilestoneUpdatedEmail } from "./templates/milestone-updated";
export { renderPaymentDueEmail } from "./templates/payment-due";
export { renderDeliveredEmail } from "./templates/delivered";

export function renderEmail<T extends EmailTemplateType>(
  type: T,
  context: EmailContextMap[T],
): RenderedEmail {
  switch (type) {
    case "invite":
      return renderInviteEmail(context as EmailContextMap["invite"]);
    case "project_activated":
      return renderProjectActivatedEmail(context as EmailContextMap["project_activated"]);
    case "milestone_updated":
      return renderMilestoneUpdatedEmail(context as EmailContextMap["milestone_updated"]);
    case "payment_due":
      return renderPaymentDueEmail(context as EmailContextMap["payment_due"]);
    case "delivered":
      return renderDeliveredEmail(context as EmailContextMap["delivered"]);
    default:
      throw new Error(`Unknown email template type: ${type}`);
  }
}
