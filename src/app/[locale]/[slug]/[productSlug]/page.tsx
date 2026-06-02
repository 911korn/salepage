export {
  default,
  generateMetadata,
  generateStaticParams,
} from "../../s/[slug]/[productSlug]/page";

// Route segment config does not transfer through re-exports, so the ISR
// window must be declared here too (mirrors ../../s/[slug]/[productSlug]/page).
export const revalidate = 60;
