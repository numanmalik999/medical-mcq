// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

serve(async (_req: Request) => {
  // Redirect the user back to the client application's subscriptions page with a cancel status
  const clientCancelUrl = `${Deno.env.get('VITE_BASE_URL') || 'http://localhost:8080'}/user/subscriptions?status=cancelled`;
  
  return new Response(null, {
    status: 303, // See Other
    headers: {
      'Location': clientCancelUrl,
    },
  });
});