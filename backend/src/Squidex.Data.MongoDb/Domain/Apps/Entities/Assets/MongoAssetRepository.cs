﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschraenkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System.Runtime.CompilerServices;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Squidex.Domain.Apps.Core.Assets;
using Squidex.Domain.Apps.Entities.Assets;
using Squidex.Domain.Apps.Entities.Assets.Repositories;
using Squidex.Domain.Apps.Entities.Assets.Visitors;
using Squidex.Infrastructure;
using Squidex.Infrastructure.Counts;
using Squidex.Infrastructure.Queries;
using Squidex.Infrastructure.Translations;

namespace Squidex.Domain.Apps.Entities.MongoDb.Assets;

public sealed partial class MongoAssetRepository : MongoRepositoryBase<MongoAssetEntity>, IAssetRepository
{
    private readonly MongoCountCollection countCollection;
    private readonly string shardKey;

    static MongoAssetRepository()
    {
        MongoAssetEntity.RegisterClassMap();
    }

    public MongoAssetRepository(IMongoDatabase database, ILogger<MongoAssetRepository> log, string shardKey)
        : base(database)
    {
        countCollection = new MongoCountCollection(database, log, CollectionName());

        this.shardKey = shardKey;
    }

    public IMongoCollection<MongoAssetEntity> GetInternalCollection()
    {
        return Collection;
    }

    protected override string CollectionName()
    {
        return $"States_Assets2{shardKey}";
    }

    protected override Task SetupCollectionAsync(IMongoCollection<MongoAssetEntity> collection,
        CancellationToken ct)
    {
        return collection.Indexes.CreateManyAsync(
        [
            new CreateIndexModel<MongoAssetEntity>(
                Index
                    .Descending(x => x.LastModified)
                    .Ascending(x => x.Id)
                    .Ascending(x => x.IndexedAppId)
                    .Ascending(x => x.IsDeleted)
                    .Ascending(x => x.ParentId)
                    .Ascending(x => x.Tags)),
            new CreateIndexModel<MongoAssetEntity>(
                Index
                    .Ascending(x => x.IndexedAppId)
                    .Ascending(x => x.Slug)),
            new CreateIndexModel<MongoAssetEntity>(
                Index
                    .Ascending(x => x.IndexedAppId)
                    .Ascending(x => x.FileHash)),
            new CreateIndexModel<MongoAssetEntity>(
                Index
                    .Ascending(x => x.Id)
                    .Ascending(x => x.IsDeleted)),
        ], ct);
    }

    public async IAsyncEnumerable<Asset> StreamAll(DomainId appId,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var find = Collection.Find(x => x.IndexedAppId == appId && !x.IsDeleted);

        await foreach (var entity in find.ToAsyncEnumerable(ct).WithCancellation(ct))
        {
            yield return entity;
        }
    }

    public async Task<IResultList<Asset>> QueryAsync(DomainId appId, DomainId? parentId, Q q,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/QueryAsync"))
        {
            try
            {
                // We need to translate the query names to the document field names in MongoDB.
                var query = q.Query.AdjustToAssetModel(appId);

                if (q.Ids is { Count: > 0 })
                {
                    var filter = BuildFilter(appId, q.Ids.ToHashSet());

                    var assetEntities =
                        await Collection.Find(filter)
                            .SortByDescending(x => x.LastModified).ThenBy(x => x.Id)
                            .QueryLimit(q.Query)
                            .QuerySkip(q.Query)
                            .ToListRandomAsync(Collection, query.Random, ct);
                    long assetTotal = assetEntities.Count;

                    if (assetEntities.Count >= query.Take || query.Skip > 0)
                    {
                        if (q.NoTotal)
                        {
                            assetTotal = -1;
                        }
                        else
                        {
                            assetTotal = await Collection.Find(filter).CountDocumentsAsync(ct);
                        }
                    }

                    return ResultList.Create(assetTotal, assetEntities.OfType<Asset>());
                }
                else
                {
                    // Default means that no other filters are applied and we only query by app.
                    var (filter, isDefault) = query.BuildFilter(appId, parentId);

                    var assetEntities =
                        await Collection.Find(filter)
                            .QueryLimit(query)
                            .QuerySkip(query)
                            .QuerySort(query)
                            .ToListRandomAsync(Collection, query.Random, ct);
                    long assetTotal = assetEntities.Count;

                    if (assetEntities.Count >= query.Take || query.Skip > 0)
                    {
                        var isDefaultQuery = query.Filter == null;

                        if (q.NoTotal || (q.NoSlowTotal && !isDefaultQuery))
                        {
                            assetTotal = -1;
                        }
                        else if (isDefaultQuery)
                        {
                            // Cache total count by app and asset folder because no other filters are applied (aka default).
                            var totalKey = $"{appId}_{parentId}";

                            assetTotal = await countCollection.GetOrAddAsync(totalKey, ct => Collection.Find(filter).CountDocumentsAsync(ct), ct);
                        }
                        else
                        {
                            assetTotal = await Collection.Find(filter).CountDocumentsAsync(ct);
                        }
                    }

                    return ResultList.Create<Asset>(assetTotal, assetEntities);
                }
            }
            catch (MongoQueryException ex) when (ex.Message.Contains("17406", StringComparison.Ordinal))
            {
                throw new DomainException(T.Get("common.resultTooLarge"));
            }
        }
    }

    public async Task<IReadOnlyList<DomainId>> QueryIdsAsync(DomainId appId, HashSet<DomainId> ids,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/QueryIdsAsync"))
        {
            var assetEntities =
                await Collection.Find(BuildFilter(appId, ids)).Only(x => x.Id)
                    .ToListAsync(ct);

            var field = Field.Of<MongoAssetFolderEntity>(x => nameof(x.Id));

            return assetEntities.Select(x => DomainId.Create(x[field].AsString)).ToList();
        }
    }

    public async Task<IReadOnlyList<DomainId>> QueryChildIdsAsync(DomainId appId, DomainId parentId,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/QueryChildIdsAsync"))
        {
            var assetEntities =
                await Collection.Find(BuildFilter(appId, parentId)).Only(x => x.Id)
                    .ToListAsync(ct);

            var field = Field.Of<MongoAssetFolderEntity>(x => nameof(x.Id));

            return assetEntities.Select(x => DomainId.Create(x[field].AsString)).ToList();
        }
    }

    public async Task<Asset?> FindAssetByHashAsync(DomainId appId, string hash, string fileName, long fileSize,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/FindAssetByHashAsync"))
        {
            var assetEntity =
                await Collection.Find(x => x.IndexedAppId == appId && x.FileHash == hash && !x.IsDeleted && x.FileSize == fileSize && x.FileName == fileName)
                    .FirstOrDefaultAsync(ct);

            return assetEntity;
        }
    }

    public async Task<Asset?> FindAssetBySlugAsync(DomainId appId, string slug, bool allowDeleted,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/FindAssetBySlugAsync"))
        {
            var assetEntity =
                await Collection.Find(BuildFilter(appId, slug, allowDeleted))
                    .FirstOrDefaultAsync(ct);

            return assetEntity;
        }
    }

    public async Task<Asset?> FindAssetAsync(DomainId appId, DomainId id, bool allowDeleted,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/FindAssetAsync"))
        {
            var assetEntity =
                await Collection.Find(BuildFilter(appId, id, allowDeleted))
                    .FirstOrDefaultAsync(ct);

            return assetEntity;
        }
    }

    public async Task<Asset?> FindAssetAsync(DomainId id,
        CancellationToken ct = default)
    {
        using (Telemetry.Activities.StartActivity("MongoAssetRepository/FindAssetAsync"))
        {
            var assetEntity =
                await Collection.Find(x => x.Id == id && !x.IsDeleted)
                    .FirstOrDefaultAsync(ct);

            return assetEntity;
        }
    }

    private static FilterDefinition<MongoAssetEntity> BuildFilter(DomainId appId, HashSet<DomainId> ids)
    {
        var documentIds = ids.Select(x => DomainId.Combine(appId, x));

        return Filter.And(
            Filter.In(x => x.DocumentId, documentIds),
            Filter.Ne(x => x.IsDeleted, true));
    }

    private static FilterDefinition<MongoAssetEntity> BuildFilter(DomainId appId, string slug, bool allowDeleted)
    {
        var filter = Filter.And(Filter.Eq(x => x.IndexedAppId, appId), Filter.Eq(x => x.Slug, slug));

        if (!allowDeleted)
        {
            filter = Filter.And(filter, Filter.Ne(x => x.IsDeleted, true));
        }

        return filter;
    }

    private static FilterDefinition<MongoAssetEntity> BuildFilter(DomainId appId, DomainId id, bool allowDeleted)
    {
        var filter = Filter.Eq(x => x.DocumentId, DomainId.Combine(appId, id));

        if (!allowDeleted)
        {
            filter = Filter.And(filter, Filter.Ne(x => x.IsDeleted, true));
        }

        return filter;
    }

    private static FilterDefinition<MongoAssetEntity> BuildFilter(DomainId appId, DomainId parentId)
    {
        return Filter.And(
            Filter.Gt(x => x.LastModified, default),
            Filter.Gt(x => x.Id, DomainId.Create(string.Empty)),
            Filter.Eq(x => x.IndexedAppId, appId),
            Filter.Ne(x => x.IsDeleted, true),
            Filter.Eq(x => x.ParentId, parentId));
    }
}
