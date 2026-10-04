import Medusa from "@medusajs/js-sdk"

// Relative to the admin origin, so local and future hosted installations use
// the same authenticated session without embedding a server address.
export const adminSdk = new Medusa({ baseUrl: "/", auth: { type: "session" } })
