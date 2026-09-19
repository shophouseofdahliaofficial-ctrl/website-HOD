import type { FabricModule } from './types';
import { setupPbTextEditingBehavior } from './textEditing';

let fabricModulePromise: Promise<FabricModule> | null = null;

export function loadFabric(): Promise<FabricModule> {
  if (!fabricModulePromise) {
    fabricModulePromise = import('fabric').then((fabric) => {
      const patchPrototype = (proto: any) => {
        if (!proto || !proto._splitTextIntoLines) return;
        const originalSplit = proto._splitTextIntoLines;
        proto._splitTextIntoLines = function (this: any, text?: string) {
          let textToSplit = text || this.text || '';
          const transform = this.textTransform;
          if (transform === 'uppercase') {
            textToSplit = textToSplit.toUpperCase();
          } else if (transform === 'lowercase') {
            textToSplit = textToSplit.toLowerCase();
          } else if (transform === 'capitalize') {
            textToSplit = textToSplit.replace(/\b\w/g, (c: string) => c.toUpperCase());
          }
          return originalSplit.call(this, textToSplit);
        };
      };

      if (fabric) {
        if (fabric.FabricText) patchPrototype(fabric.FabricText.prototype);
        if (fabric.IText) patchPrototype(fabric.IText.prototype);
        if (fabric.Textbox) patchPrototype(fabric.Textbox.prototype);
        setupPbTextEditingBehavior(fabric);
      }
      return fabric;
    });
  }
  return fabricModulePromise;
}
