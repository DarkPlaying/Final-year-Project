import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AITestGenerator = () => {
  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Test Generator</CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                Generate tests using AI — embedded below. If embedding is blocked by the remote site, use the fallback link.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open('https://darkplayer23-question-paper-generator.hf.space/', '_blank')}
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[800px] bg-white rounded-lg overflow-hidden border border-slate-700">
            <iframe
              src="https://darkplayer23-question-paper-generator.hf.space/"
              className="w-full h-full border-0"
              title="AI Test Generator"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
