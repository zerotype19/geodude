// Force-clear Basic Auth session by returning 401
// Visit /admin/logout to reset browser's cached credentials
export const onRequest: PagesFunction = async () => {
  return new Response("Logged out. Close this tab and clear browser auth cache.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Optiview Admin"',
      "Cache-Control": "no-store",
    },
  });
};

