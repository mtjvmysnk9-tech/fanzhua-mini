// Qoder Sites Function 入口。_qoder/ 由运行时注入，不要打包、不要提交。
import { createDatabaseClient, createSiteContext, errorResponse, BackendError } from './_qoder/backend.mjs';
import { application } from './routes.mjs';

const handle = application({ db: createDatabaseClient(), BackendError });

Deno.serve(async request => {
  let context;
  try {
    context = createSiteContext(request);
    return await handle(context);
  } catch (error) {
    return errorResponse(error, context?.requestId);
  }
});
