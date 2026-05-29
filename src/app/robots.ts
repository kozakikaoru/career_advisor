import type { MetadataRoute } from "next";

/** 共有URL(/r/)と診断(/diagnosis)を検索エンジンから除外する(data-model.md §4)。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/r/", "/diagnosis"],
    },
  };
}
