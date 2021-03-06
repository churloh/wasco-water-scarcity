import * as React from 'react';
import CommonEmbedLayout from '../common-embed-layout';

interface Props {
  autoplay: boolean;
}

// Note: if we continue using one common embed layout for all embeds, this
// component could be removed and just used directly inside index.tsx
function ScarcityEmbed({ autoplay }: Props) {
  return <CommonEmbedLayout selectedDataType="scarcity" autoplay={autoplay} />;
}

export default ScarcityEmbed;
