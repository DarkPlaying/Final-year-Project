"use client";

import AutoScroll from "embla-carousel-auto-scroll";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface Logo {
  id: string;
  description: string;
  image: string;
  className?: string;
}

interface LogosMarqueeProps {
  heading?: string;
  logos?: Logo[];
  className?: string;
}

const LogosMarquee = ({
  heading = "Trusted by educational institutions",
  logos = [
    {
      id: "logo-1",
      description: "Institution 1",
      image: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
    {
      id: "logo-2",
      description: "Institution 2",
      image: "https://images.unsplash.com/photo-1562774053-701939374585?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
    {
      id: "logo-3",
      description: "Institution 3",
      image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
    {
      id: "logo-4",
      description: "Institution 4",
      image: "https://images.unsplash.com/photo-1576495199011-eb94736d05d6?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
    {
      id: "logo-5",
      description: "Institution 5",
      image: "https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
    {
      id: "logo-6",
      description: "Institution 6",
      image: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=200&h=80&fit=crop",
      className: "h-12 w-auto rounded",
    },
  ],
}: LogosMarqueeProps) => {
  const MarqueeRow = ({ direction = "forward" }: { direction?: "forward" | "backward" }) => (
    <Carousel
      opts={{ loop: true }}
      plugins={[AutoScroll({ 
        playOnInit: true, 
        speed: 1.5, 
        stopOnInteraction: false, 
        stopOnMouseEnter: false,
        direction 
      })]}
      className="mb-4"
    >
      <CarouselContent className="ml-0">
        {logos.concat(logos).map((logo, index) => (
          <CarouselItem
            key={`${logo.id}-${index}`}
            className="flex basis-1/3 justify-center pl-0 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
          >
            <div className="mx-10 flex shrink-0 items-center justify-center">
              <div className="bg-white/[0.03] p-4 rounded-lg border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] transition-all duration-300">
                <img
                  src={logo.image}
                  alt={logo.description}
                  className={logo.className}
                />
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );

  return (
    <section className="py-20 lg:py-32 bg-[#030303]">
      <div className="container flex flex-col items-center text-center">
        <h2 className="my-6 text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          {heading}
        </h2>
      </div>
      <div className="pt-10 md:pt-16 lg:pt-20">
        <div className="relative mx-auto flex flex-col items-center justify-center lg:max-w-5xl">
          <MarqueeRow direction="forward" />
          <MarqueeRow direction="backward" />
          <MarqueeRow direction="forward" />
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#030303] to-transparent pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#030303] to-transparent pointer-events-none"></div>
        </div>
      </div>
    </section>
  );
};

export { LogosMarquee };
