import { lazy } from "react";

const systemAppRegistry = {
  "late-hub": {
    name: "Late Hub",
    component: lazy(() => import("lateHub/App")),
  },
};

export { systemAppRegistry };
