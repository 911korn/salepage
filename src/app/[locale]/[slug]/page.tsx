export { default, generateStaticParams } from "../s/[slug]/page";

// Route segment config does not transfer through re-exports, so the ISR
// window must be declared here too (mirrors ../s/[slug]/page).
export const revalidate = 60;
