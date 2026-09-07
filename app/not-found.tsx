import Link from "next/link";
import { T } from "@/components/i18n";

export default function NotFound() {
  return (
    <main className="nf">
      <p className="eyebrow">404 — PAGE NOT FOUND</p>
      <h1 className="nf-title">
        <T
          en={
            <>
              This page got
              <br />
              <em className="abs">X-RAYed</em> through.
            </>
          }
          zh={
            <>
              这一页被
              <br />
              <em className="abs">透视</em>穿了。
            </>
          }
        />
      </h1>
      <p className="nf-sub">
        <T
          en={
            <>
              What you&apos;re looking for isn&apos;t here — maybe it&apos;s at
              the gym,
              <br />
              maybe on the next flight out.
            </>
          }
          zh={
            <>
              你要找的内容不在这里——也许它正在健身房，
              <br />
              也许在下一站旅行里。
            </>
          }
        />
      </p>
      <Link className="btn btn-primary" href="/">
        <T en="Back home ↑" zh="回首页 ↑" />
      </Link>
      <span className="nf-ghost" aria-hidden="true">
        404
      </span>
    </main>
  );
}
