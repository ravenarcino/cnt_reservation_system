// Runs once when the Next.js server starts.
//
// Every server-side date calculation (booking windows, "today", day offs,
// business hours) uses the process's local time. CNT works in Philippine
// time, but hosts such as Vercel run in UTC - so pin the server to Manila
// before any request is handled. Browsers keep using the viewer's own
// time zone.
export function register() {
  process.env.TZ = "Asia/Manila";
}
