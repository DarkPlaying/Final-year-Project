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
  className,
}: LogosMarqueeProps) => {
  const logos = [
    {
      id: "harvard",
      name: "Harvard",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" />
        </svg>
      ),
    },
    {
      id: "stanford",
      name: "Stanford",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm6 2h2v8h-2V8z" />
        </svg>
      ),
    },
    {
      id: "mit",
      name: "MIT",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <path d="M6 4v16h2V4H6zm4 0v16h2V4h-2zm4 0v16h2V4h-2zm4 0v16h2V4h-2z" />
        </svg>
      ),
    },
    {
      id: "oxford",
      name: "Oxford",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12M6 12h12" stroke="black" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: "cambridge",
      name: "Cambridge",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <path d="M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z" />
        </svg>
      ),
    },
    {
      id: "yale",
      name: "Yale",
      svg: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-auto">
          <path d="M2 2h20v20H2V2zm2 2v16h16V4H4zm8 2l4 4-4 4-4-4 4-4z" />
        </svg>
      ),
    },
  ];

  const MarqueeRow = ({ direction = "forward" }: { direction?: "forward" | "backward" }) => (
    <Carousel
      opts={{ loop: true }}
      plugins={[AutoScroll({
        playOnInit: true,
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        direction
      })]}
      className="w-full"
    >
      <CarouselContent className="-ml-4">
        {logos.concat(logos).concat(logos).map((logo, index) => (
          <CarouselItem
            key={`${logo.id}-${index}`}
            className="pl-4 basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
          >
            <div className="flex items-center justify-center h-24 group cursor-pointer">
              <div className="text-white/40 group-hover:text-white transition-colors duration-300 transform group-hover:scale-110">
                {logo.svg}
                <span className="sr-only">{logo.name}</span>
              </div>
              <span className="ml-3 text-lg font-semibold text-white/40 group-hover:text-white transition-colors duration-300 hidden md:block">
                {logo.name}
              </span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );

  return (
    <section className="py-16 bg-[#030303] border-y border-white/[0.05]">
      <div className="container flex flex-col items-center text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-medium text-white/80">
          {heading}
        </h2>
      </div>
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#030303] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#030303] to-transparent z-10 pointer-events-none" />

        <MarqueeRow direction="forward" />
      </div>
    </section>
  );
};

export { LogosMarquee };
