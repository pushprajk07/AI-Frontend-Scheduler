import { Prisma, PrismaClient } from './generated/prisma/index.js';

// add prisma to the NodeJS global type
// interface CustomNodeJsGlobal extends Global {
//   prisma: PrismaClient;
// }

// Prevent multiple instances of Prisma Client in development
// declare const global: CustomNodeJsGlobal;

enum PrismaOperation {
    findUnique = 'findUnique',
    findUniqueOrThrow = 'findUniqueOrThrow',
    findMany = 'findMany',
    findFirst = 'findFirst',
    findFirstOrThrow = 'findFirstOrThrow',
    create = 'create',
    createMany = 'createMany',
    createManyAndReturn = 'createManyAndReturn',
    update = 'update',
    updateMany = 'updateMany',
    updateManyAndReturn = 'updateManyAndReturn',
    upsert = 'upsert',
    delete = 'delete',
    deleteMany = 'deleteMany',
    executeRaw = 'executeRaw',
    queryRaw = 'queryRaw',
    aggregate = 'aggregate',
    count = 'count',
    runCommandRaw = 'runCommandRaw',
    findRaw = 'findRaw',
    groupBy = 'groupBy'
}

const getGlobalFiltersExtension = () => {
    return Prisma.defineExtension({
        name: 'globalFilters',
        query: {
            $allModels: {
                async $allOperations({ operation, args, query }) {
                    const globalData = { isDeleted: false };

                    switch (operation) {
                        case PrismaOperation.findUnique:
                        case PrismaOperation.findUniqueOrThrow:
                        case PrismaOperation.findMany:
                        case PrismaOperation.findFirst:
                        case PrismaOperation.findFirstOrThrow:
                        case PrismaOperation.count:
                        case PrismaOperation.groupBy:
                        case PrismaOperation.aggregate:
                        case PrismaOperation.update:
                        case PrismaOperation.updateMany:
                        case PrismaOperation.updateManyAndReturn:
                        case PrismaOperation.delete:
                        case PrismaOperation.deleteMany:
                            args.where = {
                                ...globalData,
                                ...(args.where as { [key in string]?: any })
                            } as typeof args.where;
                            break;
                        case PrismaOperation.create:
                            if (args.data && typeof args.data === 'object')
                                args.data = {
                                    ...(globalData as any),
                                    ...(args.data as { [key in string]?: any })
                                } as typeof args.data;
                            break;
                        case PrismaOperation.createMany:
                        case PrismaOperation.createManyAndReturn:
                            if (args.data && Array.isArray(args.data))
                                for (let i = 0; i < args.data.length; i++) {
                                    const item = args.data[i];
                                    if (typeof item === 'object')
                                        args.data[i] = {
                                            ...(globalData as any),
                                            ...(item as { [key in string]?: any })
                                        } as (typeof args.data)[number];
                                }
                            break;

                        case PrismaOperation.upsert:
                            args.where = {
                                ...(globalData as any),
                                ...(args.where as { [key in string]?: any })
                            } as typeof args.where;
                            if (args.create && typeof args.create === 'object')
                                args.create = {
                                    ...(globalData as any),
                                    ...(args.create as { [key in string]?: any })
                                } as typeof args.create;
                            break;
                        default:
                            break;
                    }

                    return await query(args);
                }
            }
        }
    });
};

const prisma = new PrismaClient().$extends(getGlobalFiltersExtension());

export default prisma;
