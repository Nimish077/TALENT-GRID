import { useEffect, useState } from "react";
import { isDemoLoginEnabled } from "./demo-accounts.js";
import { configApi } from "./endpoints.js";

// Whether to show the one-click demo accounts on a login page.
// On if EITHER the client was built with VITE_DEMO_LOGIN=true, OR the server
// says so (GET /config: DEMO_LOGIN / SEED_DEMO on the backend). The server check
// is a runtime switch, so it needs no rebuild. A failed check just means "off".
export function useDemoLogin() {
  const buildFlag = isDemoLoginEnabled();
  const [serverFlag, setServerFlag] = useState(false);

  useEffect(() => {
    if (buildFlag) return undefined;
    let active = true;
    configApi
      .get()
      .then((data) => active && setServerFlag(data?.demo_login === true))
      .catch(() => active && setServerFlag(false));
    return () => {
      active = false;
    };
  }, [buildFlag]);

  return buildFlag || serverFlag;
}
