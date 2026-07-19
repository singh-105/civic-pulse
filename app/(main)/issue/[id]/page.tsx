import IssueDetailClient from "./IssueDetailClient";

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function Page() {
  return <IssueDetailClient />;
}
