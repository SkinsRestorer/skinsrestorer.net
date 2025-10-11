'use client';

import {useState} from 'react';
import {Label} from '~/components/ui/label';
import {Input} from '~/components/ui/input';
import {toast} from 'sonner';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '~/components/ui/select';
import {Button} from '~/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '~/components/ui/card';

export const UploadCard = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [skinType, setSkinType] = useState<'classic' | 'slim'>('classic');
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  async function uploadSkin() {
    if (!selectedFile) {
      toast.warning('Please select a PNG skin file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('variant', skinType);

    setLoading(true);
    setResultUrl(null);

    toast.promise(
      fetch('https://api.mineskin.org/v2/queue', {
        method: 'POST',
        headers: {
          'User-Agent': 'SkinsRestorer-Generator/1.0',
        },
        body: formData,
      })
        .then(async (res) => {
          const body = await res.json();
          if (!body.success) {
            throw new Error(body.errors?.[0]?.message || 'API request failed');
          }

          const jobId = body.job.id as string;

          const pollJob = async (): Promise<any> => {
            const jobResponse = await fetch(`https://api.mineskin.org/v2/queue/${jobId}`, {
              headers: {
                'User-Agent': 'SkinsRestorer-Generator/1.0',
              },
            });
            const jobData = await jobResponse.json();
            if (!jobData.success) {
              throw new Error(jobData.errors?.[0]?.message || 'Job failed');
            }
            const job = jobData.job;
            if (job.status === 'completed') return jobData;
            if (job.status === 'failed') throw new Error('Job failed to complete');
            await new Promise((r) => setTimeout(r, 1000));
            return pollJob();
          };

          const completed = await pollJob();
          const url = `https://minesk.in/${completed.skin.uuid}`;

          if (!url) throw new Error('Could not extract skin URL from response');
          setResultUrl(url);
        })
        .finally(() => setLoading(false)),
      {
        loading: 'Uploading skin to MineSkin...',
        success: 'Skin uploaded successfully.',
        error: (e) => `Failed to upload skin: ${e}`,
      }
    );
  }

  const command = resultUrl ? `/skin url "${resultUrl}"` : '';

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <CardTitle>Upload Skin</CardTitle>
        <CardDescription>
          Upload a PNG skin file and get a copyable <code className="highlight-code">/skin url</code> command
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skin-png-file">Select skin .png file</Label>
          <Input
            id="skin-png-file"
            type="file"
            accept=".png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="skin-type">Skin type</Label>
          <Select value={skinType} onValueChange={(v) => setSkinType(v as 'classic' | 'slim')}>
            <SelectTrigger id="skin-type">
              <SelectValue placeholder="Skin type"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="slim">Slim</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={uploadSkin} disabled={loading} className="w-full">
          Generate /skin url
        </Button>

        {resultUrl && (
          <div className="space-y-2">
            <Label htmlFor="skin-command">Copy this command</Label>
            <div className="flex gap-2 items-center">
              <Input id="skin-command" readOnly value={command} className="flex-1"/>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(command);
                    toast.success('Copied to clipboard');
                  } catch (e) {
                    toast.error('Failed to copy');
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <div className="text-xs text-muted-foreground break-all">
              MineSkin URL: <a className="underline" href={resultUrl} target="_blank"
                               rel="noreferrer noopener">{resultUrl}</a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

