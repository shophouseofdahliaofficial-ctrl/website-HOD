declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenResponse {
        access_token?: string;
        error?: string;
        error_description?: string;
      }

      interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }

      interface TokenClient {
        requestAccessToken: (options?: { prompt?: string }) => void;
      }

      function initTokenClient(config: TokenClientConfig): TokenClient;
    }
  }

  namespace picker {
    enum Action {
      PICKED = 'picked',
      CANCEL = 'cancel',
    }

    enum Feature {
      MULTISELECT_ENABLED = 'multiselect-enabled',
    }

    enum ViewId {
      DOCS_IMAGES = 'docs-images',
      PHOTOS = 'photos',
    }

    interface DocumentObject {
      id: string;
      name: string;
      mimeType: string;
      url?: string;
    }

    interface ResponseObject {
      action: Action;
      docs?: DocumentObject[];
    }

    type Callback = (data: ResponseObject) => void;

    class PickerBuilder {
      addView(viewId: ViewId): PickerBuilder;
      setOAuthToken(token: string): PickerBuilder;
      setDeveloperKey(key: string): PickerBuilder;
      enableFeature(feature: Feature): PickerBuilder;
      setCallback(callback: Callback): PickerBuilder;
      build(): { setVisible: (visible: boolean) => void };
    }
  }
}

interface Gapi {
  load: (
    api: string,
    options: { callback: () => void; onerror?: (error: unknown) => void },
  ) => void;
}

interface Window {
  gapi?: Gapi;
}
