import IssueDetailPage from "./IssueDetailClient";

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: '1' }];
}

export default function Page() {
  return <IssueDetailPage />;
}
