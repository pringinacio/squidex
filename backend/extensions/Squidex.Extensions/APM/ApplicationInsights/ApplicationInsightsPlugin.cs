﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschraenkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using Azure.Monitor.OpenTelemetry.Exporter;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Squidex.Infrastructure.Plugins;

namespace Squidex.Extensions.APM.ApplicationInsights
{
    public sealed class ApplicationInsightsPlugin : IPlugin
    {
        public void ConfigureServices(IServiceCollection services, IConfiguration config)
        {
            services.AddOpenTelemetryTracing(builder =>
            {
                if (config.GetValue<bool>("logging:applicationInsights:enabled"))
                {
                    builder.AddAzureMonitorTraceExporter(options =>
                    {
                        config.GetSection("logging:applicationInsights").Bind(options);
                    });
                }
            });
        }
    }
}
