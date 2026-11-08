import { createFileRoute } from "@tanstack/react-router";
import IndexPage from "@/components/home/home-page";
import { HomeLayout } from "@/components/home-layout";
import { getPageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => getPageHead("/"),
  component: () => (
    <HomeLayout>
      <IndexPage />
    </HomeLayout>
  ),
});
