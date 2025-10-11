'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export function OnlineCard() {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  useEffect(() => {
    fetch('https://api.mineskin.org/v2/delay', {
      headers: {
        'User-Agent': 'SkinsRestorer-Generator/1.0',
      },
    })
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));
  }, []);

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">API Status</CardTitle>
          <div
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
              status === 'loading'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                : status === 'online'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {status === 'loading' ? 'LOADING' : status === 'online' ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>
          Powered by{' '}
          <a
            href="https://mineskin.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            MineSkin
          </a>
        </CardDescription>
      </CardContent>
    </Card>
  );
}

