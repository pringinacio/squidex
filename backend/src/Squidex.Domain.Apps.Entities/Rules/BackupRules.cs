﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschraenkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using Squidex.Domain.Apps.Core.Rules;
using Squidex.Domain.Apps.Entities.Backup;
using Squidex.Domain.Apps.Entities.Rules.DomainObject;
using Squidex.Domain.Apps.Events.Rules;
using Squidex.Infrastructure;
using Squidex.Infrastructure.Commands;
using Squidex.Infrastructure.EventSourcing;

namespace Squidex.Domain.Apps.Entities.Rules;

public sealed class BackupRules(Rebuilder rebuilder) : IBackupHandler
{
    private const int BatchSize = 100;
    private readonly HashSet<DomainId> ruleIds = [];

    public string Name { get; } = "Rules";

    public Task<bool> RestoreEventAsync(Envelope<IEvent> @event, RestoreContext context,
        CancellationToken ct)
    {
        switch (@event.Payload)
        {
            case RuleCreated:
                ruleIds.Add(@event.Headers.AggregateId());
                break;
            case RuleDeleted:
                ruleIds.Remove(@event.Headers.AggregateId());
                break;
        }

        return Task.FromResult(true);
    }

    public async Task RestoreAsync(RestoreContext context,
        CancellationToken ct)
    {
        if (ruleIds.Count > 0)
        {
            await rebuilder.InsertManyAsync<RuleDomainObject, Rule>(ruleIds, BatchSize, ct);
        }
    }
}
