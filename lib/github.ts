/* ============================================================
 * GitHub 年度数据（客户端实时取，逐级降级）
 * 从 YearReport 抽出的数据模块：取数/整形/失败标记都在这里，
 * 组件只消费状态。未认证公共 API（60 次/时/IP），失败即 failed。
 * ============================================================ */

import { GITHUB_USER } from "@/config/site";

export type GitHubYearStats = {
  repos?: number;
  followers?: number;
  /** 今年仍有 push 的仓库数 */
  pushedThisYear?: number;
  top?: { name: string; stars: number; url: string }[];
  failed?: boolean;
};

type Repo = {
  name: string;
  stargazers_count?: number;
  pushed_at?: string;
  html_url?: string;
};

export async function fetchGitHubYear(year: string): Promise<GitHubYearStats> {
  try {
    const u = await fetch(`https://api.github.com/users/${GITHUB_USER}`).then(
      (r) => (r.ok ? r.json() : null),
    );
    const repos = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`,
    ).then((r) => (r.ok ? r.json() : null));

    if (!u && !Array.isArray(repos)) return { failed: true };

    const top: GitHubYearStats["top"] = Array.isArray(repos)
      ? [...(repos as Repo[])]
          .sort(
            (a, b) =>
              (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0) ||
              (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""),
          )
          .slice(0, 3)
          .map((r) => ({
            name: r.name,
            stars: r.stargazers_count ?? 0,
            url: r.html_url ?? "",
          }))
      : undefined;

    return {
      repos: u?.public_repos,
      followers: u?.followers,
      pushedThisYear: Array.isArray(repos)
        ? (repos as Repo[]).filter(
            (r) => typeof r.pushed_at === "string" && r.pushed_at.startsWith(year),
          ).length
        : undefined,
      top,
    };
  } catch {
    return { failed: true };
  }
}
