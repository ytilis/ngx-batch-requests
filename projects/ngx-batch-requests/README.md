# ngx-batch-requests

Angular (5+) HTTP batching module to reduce the number of HTTP requests and increase performance

## Get Started

### Installation

You can install this package locally with npm.

```bash
npm i ngx-batch-requests
```

### Usage
Add `BatchRequestsModule` to your `AppModule` imports. Make sure Angular's `HttpClientModule` is also imported since this module makes use of it.

In your `AppModule` providers, you can set the configuration like so:

```typescript

{ provide: BATCH_REQUESTS_CONFIG,
  useValue: {
    bufferTimeSpan: 250,
    bufferMaxSize: 20,
  
    batchPath: '/api/$batch',
    batchMethod: 'POST',
  
    defaultRequestOptions: {
      withCredentials: true
    },
  
    parseBody: (body): any => JSON.parse(body),
  
    shouldBatch: (req): boolean => true,
  }
}
```

Note that you do NOT need to provide all of these configuration options. 
Above is the default configuration which will be deep merged with whatever additional or replacement options you provide. 
So if you don't do this step, these are the options which will be used out of the box. 

### Example
Here is a simple example of how to import and configure BatchRequests:

```typescript
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { BatchRequestsModule, BATCH_REQUESTS_CONFIG } from 'ngx-batch-requests';

@NgModule({
  imports: [
    BrowserModule,
    HttpClientModule,
    BatchRequestsModule,
  ],
  providers: [
    { provide: BATCH_REQUESTS_CONFIG,
      useValue: {
        batchPath: '/api/batch',
      }
    },
  ],
})
export class AppModule { }

```

You'll note that in this example the only thing we cared to change was the `batchPath`. 
Now, any requests that come in within 250ms of each other will be sent in batches of up to 20, instead of individually.

## History
This is meant as a replacement for [ngx-http-batcher](https://www.npmjs.com/package/ngx-http-batcher), as that project has not been updated to work with interceptors or HttpClient. 

The changes are based heavily on the work done by [srikrsna](https://github.com/jonsamwell/ngx-http-batcher/issues/2#issuecomment-405587233) which I later heavily modified.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).
