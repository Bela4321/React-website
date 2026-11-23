// The site is static files; the Worker in front sends www.belaschinke.com to the bare
// domain and serves the ClusterSearch API.
import { handleClusterSearch } from "./clustersearch/handler";

export { ClusterBudget } from "./clustersearch/budget";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "www.belaschinke.com") {
      url.hostname = "belaschinke.com";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/clustersearch" || url.pathname === "/api/clustersearch/status") {
      return handleClusterSearch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
