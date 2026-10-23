import { fetchStoreProductsServer } from "@/lib/server-data";
import { AllProductsClient } from "@/components/store/AllProductsClient";
import { EditorialIntro } from "@/components/ui/EditorialIntro";
import { Reveal } from "@/components/ui/Reveal";

export const revalidate = 60;

export default async function ProductsPage() {
  const products = await fetchStoreProductsServer();
  const collections = Array.from(
    new Set(products.map((product) => product.collection ?? "").filter(Boolean)),
  );
  const tags = Array.from(new Set(products.map((product) => product.tag).filter(Boolean)));

  return (
    <div>
      <section className="border-b border-[var(--line)] py-beat">
        <Reveal>
          <EditorialIntro
            eyebrow={`${String(products.length).padStart(2, "0")} products`}
            title="The Culvoy Collection"
            description={null}
          />
          <div className="site-container">
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Tea ware, tableware and objects for everyday use.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-[var(--paper-deep)] bg-grain py-beat">
        <div className="site-container">
          <AllProductsClient products={products} collections={collections} tags={tags} />
        </div>
      </section>
    </div>
  );
}
