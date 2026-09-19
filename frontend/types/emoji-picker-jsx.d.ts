import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type Picker from 'emoji-picker-element';

type EmojiPickerIntrinsicProps = DetailedHTMLProps<HTMLAttributes<Picker>, Picker>;

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'emoji-picker': EmojiPickerIntrinsicProps;
    }
  }
}

export {};
