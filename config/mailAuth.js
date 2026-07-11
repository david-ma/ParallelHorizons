// MailCatcher transport for local password-reset testing.
// https://mailcatcher.me/  —  SMTP :1025, web UI :1080
export const transport = {
  host: '127.0.0.1',
  port: 1025,
  secure: false,
  auth: {
    user: 'user@email.com',
    pass: 'password',
  },
}
