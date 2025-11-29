import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { GraduationCap, BookOpen, Users, Award, CheckCircle2, Home, Info, Mail, Calendar, Code, FileText, User as UserIcon, Clock } from 'lucide-react';
import { AnimeNavBar } from '@/components/ui/anime-navbar';
import { ButtonColorful } from '@/components/ui/button-colorful';
import { LogosMarquee } from '@/components/ui/logos-marquee';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import { motion } from 'framer-motion';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { PremiumTestimonials } from '@/components/ui/premium-testimonials';
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline';

/**
 * Landing Page Component
 * Beautiful animated introduction to the EduPortal platform
 * Automatically redirects authenticated users to their dashboard
 */
const Index = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  useEffect(() => {
    // Redirect authenticated users to their dashboard
    if (user) {
      navigate(`/dashboard/${user.role}`, {
        replace: true
      });
    }
  }, [user, navigate]);
  const features = [{
    icon: <BookOpen className="h-8 w-8" />,
    title: 'Interactive Learning',
    description: 'Access comprehensive study materials and interactive content'
  }, {
    icon: <Users className="h-8 w-8" />,
    title: 'Collaborative Environment',
    description: 'Connect with teachers and fellow students in real-time'
  }, {
    icon: <Award className="h-8 w-8" />,
    title: 'Track Progress',
    description: 'Monitor your performance with detailed analytics and insights'
  }];
  const benefits = ['AI-Powered Test Generation', 'Secure Role-Based Dashboards', 'UNOM Mark Submission System', 'Real-time Assignment Tracking', 'Automated Grading & Feedback', 'Workspace-based Organization'];
  const navItems = [{
    name: 'Home',
    url: '#home',
    icon: Home
  }, {
    name: 'About',
    url: '#about',
    icon: Info
  }, {
    name: 'Features',
    url: '#features',
    icon: BookOpen
  }, {
    name: 'Benefits',
    url: '#benefits',
    icon: CheckCircle2
  }, {
    name: 'Testimonials',
    url: '#testimonials',
    icon: UserIcon
  }, {
    name: 'Contact',
    url: '#contact',
    icon: Mail
  }];

  const timelineData = [
    {
      id: 1,
      title: "Registration",
      date: "Step 1",
      content: "Secure sign-up with role-based access (Student, Teacher, Admin).",
      category: "Onboarding",
      icon: UserIcon,
      relatedIds: [2],
      status: "completed" as const,
      energy: 100,
    },
    {
      id: 2,
      title: "Workspace Access",
      date: "Step 2",
      content: "Join dedicated workspaces for your classes and subjects.",
      category: "Organization",
      icon: Home,
      relatedIds: [1, 3],
      status: "completed" as const,
      energy: 90,
    },
    {
      id: 3,
      title: "Active Learning",
      date: "Ongoing",
      content: "Access syllabi, submit assignments, and view announcements.",
      category: "Engagement",
      icon: BookOpen,
      relatedIds: [2, 4],
      status: "in-progress" as const,
      energy: 80,
    },
    {
      id: 4,
      title: "AI Assessment",
      date: "Exam Time",
      content: "Take AI-generated tests and secure online exams.",
      category: "Evaluation",
      icon: Code,
      relatedIds: [3, 5],
      status: "pending" as const,
      energy: 60,
    },
    {
      id: 5,
      title: "Progress Tracking",
      date: "Results",
      content: "View detailed marks, UNOM reports, and performance analytics.",
      category: "Achievement",
      icon: Award,
      relatedIds: [4],
      status: "pending" as const,
      energy: 40,
    },
  ];
  return <div className="min-h-screen w-full bg-[#030303] overflow-x-hidden">
    {/* Animated Navigation Bar */}
    <AnimeNavBar items={navItems} defaultActive="Home" />

    {/* Hero Section - Geometric Animation */}
    <section id="home" className="w-full pt-8">
      <HeroGeometric
        badge="Edu Online"
        title1="Smart Education"
        title2="Management System"
      >
        <ButtonColorful label="Get Started" onClick={() => navigate('/login')} />
      </HeroGeometric>
    </section>

    {/* Container Scroll Animation Section - MOVED TO SECOND */}
    <section id="about" className="w-full bg-[#030303] py-10 md:py-20">
      <ContainerScroll
        titleComponent={
          <>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4 text-center px-4">
              Experience the future of <br />
              <span className="text-4xl md:text-5xl lg:text-6xl font-bold mt-1 leading-none bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                Edu Online
              </span>
            </h2>
          </>
        }
      >
        <img
          src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1400"
          alt="Education platform preview"
          className="mx-auto rounded-2xl object-cover h-full w-full object-center"
          draggable={false}
        />
      </ContainerScroll>
    </section>

    {/* Features Section - Interactive Timeline */}
    <section id="features" className="w-full bg-black py-10 md:py-20">
      <RadialOrbitalTimeline timelineData={timelineData} />
    </section>

    {/* Benefits Section - Enhanced Bento Grid */}
    <section id="benefits" className="w-full py-16 md:py-20 lg:py-32 bg-black/50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Why Choose Edu Online?
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Experience the future of education with our comprehensive platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-4 max-w-7xl mx-auto">
          {/* Main feature - Large card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="col-span-1 md:col-span-4 lg:col-span-4"
          >
            <div className="relative h-full min-h-[20rem] rounded-[1.25rem] border-[0.75px] border-white/[0.08] p-2 md:rounded-[1.5rem] md:p-3">
              <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
              />
              <div className="relative h-full bg-white/[0.03] rounded-xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex flex-col h-full justify-between gap-6">
                  <div className="w-fit rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-rose-500/20 p-3">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl md:text-3xl font-semibold text-white">
                      Comprehensive Learning Management
                    </h3>
                    <p className="text-base md:text-lg text-white/60">
                      Track student progress, manage assignments, conduct secure AI-generated examinations, and provide real-time feedback all in one integrated platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Side features - 2 stacked cards */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="relative h-full min-h-[9.5rem] rounded-[1.25rem] border-[0.75px] border-white/[0.08] p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="relative h-full bg-white/[0.03] rounded-xl p-6 backdrop-blur-sm">
                  <div className="space-y-3">
                    <div className="w-fit rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-rose-500/20 p-2">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Real-time Collaboration</h3>
                    <p className="text-sm text-white/60">
                      Connect with teachers and students instantly in Workspaces
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="relative h-full min-h-[9.5rem] rounded-[1.25rem] border-[0.75px] border-white/[0.08] p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="relative h-full bg-white/[0.03] rounded-xl p-6 backdrop-blur-sm">
                  <div className="space-y-3">
                    <div className="w-fit rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-rose-500/20 p-2">
                      <BookOpen className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">Rich Content Library</h3>
                    <p className="text-sm text-white/60">
                      Access comprehensive study materials and Syllabi
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom row - 3 equal cards */}
          {benefits.slice(0, 3).map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              viewport={{ once: true }}
              className="col-span-1 md:col-span-2 lg:col-span-2"
            >
              <div className="relative h-full min-h-[12rem] rounded-[1.25rem] border-[0.75px] border-white/[0.08] p-2 md:rounded-[1.5rem] md:p-3">
                <GlowingEffect
                  spread={40}
                  glow={true}
                  disabled={false}
                  proximity={64}
                  inactiveZone={0.01}
                  borderWidth={3}
                />
                <div className="relative h-full bg-white/[0.03] rounded-xl p-6 backdrop-blur-sm flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="text-base text-white/70">{benefit}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional benefits list */}
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto mt-8">
          {benefits.slice(3).map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex items-start gap-3 p-5 bg-white/[0.03] border border-white/[0.08] rounded-lg backdrop-blur-sm hover:bg-white/[0.05] transition-all duration-300"
            >
              <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <span className="text-sm text-white/70">{benefit}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Logo Marquee Section */}
    <div className="w-full bg-[#030303] py-10 md:py-16">
      <LogosMarquee heading="Trusted by educational institutions worldwide" />
    </div>

    {/* Testimonials Section */}
    <div id="testimonials" className="w-full">
      <PremiumTestimonials />
    </div>

    {/* CTA Section */}
    <section id="contact" className="w-full py-16 md:py-20 lg:py-32 bg-[#030303]">
      <div className="container mx-auto px-4 max-w-5xl">
        <Card className="max-w-3xl mx-auto bg-white/[0.03] border-white/[0.08] backdrop-blur-sm text-center">
          <CardHeader>
            <CardTitle className="text-4xl lg:text-5xl font-bold text-white mb-4">Ready to Get Started?</CardTitle>
            <CardDescription className="text-lg text-white/50">
              Join thousands of students and educators already using Edu Online
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <ButtonColorful label="Sign In Now" onClick={() => navigate('/login')} />
          </CardContent>
        </Card>
      </div>
    </section>

    {/* Footer */}
    <footer className="w-full border-t border-white/[0.08] py-12 md:py-16 bg-black">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-4">
              <GraduationCap className="w-8 h-8 text-white mr-2" />
              <h3 className="text-xl font-bold text-white">Edu Online</h3>
            </div>
            <p className="text-white/50 text-sm">
              Transforming education through innovative technology and modern learning experiences.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/50 hover:text-white transition-colors text-sm">Home</a></li>
              <li><a href="#about" className="text-white/50 hover:text-white transition-colors text-sm">About</a></li>
              <li><a href="#features" className="text-white/50 hover:text-white transition-colors text-sm">Features</a></li>
              <li><a href="#contact" className="text-white/50 hover:text-white transition-colors text-sm">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-white/50 hover:text-white transition-colors text-sm">Privacy Policy</a></li>
              <li><a href="#" className="text-white/50 hover:text-white transition-colors text-sm">Terms of Service</a></li>
              <li><a href="#" className="text-white/50 hover:text-white transition-colors text-sm">Cookie Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Connect</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                  <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3" />
                </svg>
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                  <path d="M6.94 5a2 2 0 1 1-4-.002a2 2 0 0 1 4 .002M7 8.48H3V21h4zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91z" />
                </svg>
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                  <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.08] pt-8 text-center">
          <p className="text-white/40 text-sm">&copy; 2025 Edu Online. All rights reserved.</p>
        </div>
      </div>
    </footer>
  </div>;
};
export default Index;