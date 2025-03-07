﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschraenkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Squidex.Domain.Apps.Entities.History;

namespace Squidex.Areas.Frontend.Middlewares;

public sealed class NotifoMiddleware(RequestDelegate next, IOptions<NotifoOptions> options)
{
    private readonly string? workerUrl = GetUrl(options.Value);

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.Equals("/notifo-sw.js", StringComparison.Ordinal) && workerUrl != null)
        {
            context.Response.Headers[HeaderNames.ContentType] = "text/javascript";

            var script = $"importScripts('{workerUrl}')";

            await context.Response.WriteAsync(script, context.RequestAborted);
        }
        else
        {
            await next(context);
        }
    }

    private static string? GetUrl(NotifoOptions options)
    {
        if (!options.IsConfigured())
        {
            return null;
        }

        if (options.ApiUrl.Contains("localhost:5002", StringComparison.Ordinal))
        {
            return "https://localhost:3002/notifo-sdk-worker.js";
        }
        else
        {
            return $"{options.ApiUrl}/build/notifo-sdk-worker.js";
        }
    }
}
