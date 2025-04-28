import React from 'react';
import { Layout, Card } from '@/components/ui';
import { FeatureBanner } from '@/components/common/FeatureBanner';

export default function ProfilePage() {
  return (
    <Layout>
      <div className="mt-10">
        <FeatureBanner title="Tactician's Profile" />
        <Card className="mt-4">
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-cream/80">
              Track your TFT statistics, match history, and favorite compositions!
            </p>
            <p className="text-cream/60 text-sm mt-4">
              Coming soon...
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
