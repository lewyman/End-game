import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Package, Sparkles, BookOpen, Clock, GraduationCap, Lightbulb, Download, ShoppingCart } from "lucide-react";

const products = [
  {
    title: "Nursing Tech Survival Kit",
    price: "$9.99",
    description: "Complete 42-page digital toolkit with 15+ tested tools. Includes: Epocrates drug guide, Anki flashcards, NotebookLM AI study buddy, iLovePDF file tools, Notion trackers, EHR shortcuts, and step-by-step workflows.",
    icon: Package,
    status: "Available Now",
    previewUrl: "/nursing-tech-survival-kit-PREVIEW.pdf",
    buyUrl: "https://buy.stripe.com/dRm3cv8ks9Eq49m5qAgA800"
  }
];

const inTheWorks = [
  {
    title: "EHR Efficiency Masterclass",
    price: "$49",
    description: "Master Epic, Cerner, and Meditech. Save 2+ hours per shift with efficient documentation workflows.",
    icon: Lightbulb,
    status: "Coming Soon"
  }
];

const subscriptions = [
  {
    title: "Tech at the Bedside Pro",
    price: "$7/month",
    description: "Premium newsletter with exclusive content, early access to guides, and direct Q&A access. Cancel anytime.",
    icon: Sparkles,
    status: "Coming Soon"
  }
];

function ProductCard({ item }: { item: any }) {
  const Icon = item.icon;
  const isAvailable = item.status === "Available Now";
  return (
    <Card className={`h-full ${!isAvailable ? 'opacity-75' : ''}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className={`text-xs font-medium uppercase tracking-wide ${isAvailable ? 'text-green-600' : 'text-muted-foreground'}`}>
            {item.status}
          </span>
        </div>
        <CardTitle className="mt-4">{item.title}</CardTitle>
        <CardDescription className="text-lg font-semibold text-primary">
          {item.price}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">{item.description}</p>
        {isAvailable && item.previewUrl && (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <a href={item.previewUrl} download>
                <Download className="w-4 h-4 mr-2" />
                Download Free Preview
              </a>
            </Button>
            <Button className="w-full" asChild>
              <a href={item.buyUrl} target="_blank" rel="noopener noreferrer">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Full Guide
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Products() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-primary py-16 text-center text-primary-foreground">
        <h1 className="text-4xl font-bold md:text-5xl mb-4">
          Products <span className="text-2xl md:text-3xl font-normal">by Tech at the Bedside</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-primary-foreground/90">
          Tools, courses, and resources to help you master nursing technology
        </p>
      </section>

      {/* Products Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Available Now</h2>
        </div>
        <p className="text-muted-foreground mb-6">Digital downloads and resources</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.title} item={product} />
          ))}
        </div>
      </section>

      {/* In the Works Section */}
      <section className="container mx-auto px-4 py-12 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">In the Works</h2>
        </div>
        <p className="text-muted-foreground mb-6">Upcoming courses and resources</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {inTheWorks.map((course) => (
            <ProductCard key={course.title} item={course} />
          ))}
        </div>
      </section>

      {/* Subscriptions Section */}
      <section className="container mx-auto px-4 py-12 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Subscriptions</h2>
        </div>
        <p className="text-muted-foreground mb-6">Recurring memberships with exclusive benefits</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => (
            <ProductCard key={sub.title} item={sub} />
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="bg-muted py-16 text-center">
        <div className="container mx-auto max-w-md px-4">
          <Mail className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold">Get Notified</h2>
          <p className="mt-2 text-muted-foreground">
            Be the first to know when new products launch. Subscribe to the newsletter!
          </p>
          <Button size="lg" className="mt-6" asChild>
            <a href="/#newsletter">Subscribe to Newsletter</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
