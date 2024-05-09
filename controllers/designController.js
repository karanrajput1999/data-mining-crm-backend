const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const response = require("../utils/response");
const getToken = require("../utils/getToken");
const session = require("../utils/session");
class DesignController {
  async getDesign(req, res) {
    try {
      const token = await getToken(req, res);

      if (token) {
        const { isActive } = await prisma.user.findFirst({
          where: {
            token: parseInt(token),
          },
        });

        if (isActive) {
          const loggedInUser = await prisma.user.findFirst({
            where: {
              token: parseInt(token),
            },
            select: {
              id: true,
              email: true,
              password: true,
              adminId: true,
              ivrCampaigns: {
                select: {
                  id: true,
                  ivrCampaignName: true,
                  ivrCampaignDescription: true,
                  numbers: true,
                  speeches: true,
                },
              },
              designs: true,
            },
          });

          async function fetchItemsRecursively(designId) {
            const items = await prisma.ivrDesign.findMany({
              where: {
                parentId: designId,
              },
            });

            // Recursively fetch items for each item
            const nestedItems = await Promise.all(
              items.map(async (item) => {
                item.items = await fetchItemsRecursively(item.id);
                return item;
              })
            );

            return nestedItems;
          }

          const parentDesigns = loggedInUser.designs.filter((design) => {
            return !design.parentId;
          });

          const parentDesignWithItems = await Promise.all(
            parentDesigns.map(async (design) => {
              design.items = await fetchItemsRecursively(design.id);
              return design;
            })
          );

          const { password, ...adminDataWithoutPassword } = loggedInUser;

          // update the session
          session(loggedInUser.adminId, loggedInUser.id);

          response.success(res, "IVR Design fetched", {
            ...adminDataWithoutPassword,
            designs: parentDesignWithItems,
          });
        } else {
          response.error(res, "User not active");
        }
      } else {
        response.error(res, "user not logged in.");
      }
    } catch (error) {
      console.log("error while getting IVR Design data", error);
    }
  }

  async createDesignPost(req, res) {
    try {
      const { audioText, audioFile, ivrCampaignId, key, parentId, number } =
        req.body;

      const token = await getToken(req, res);

      // admin that is creating the user
      const adminUser = await prisma.user.findFirst({
        where: {
          token: parseInt(token),
        },
      });

      if (parentId) {
        const parent = await prisma.ivrDesign.findFirst({
          where: {
            id: parentId,
          },
        });

        const childs = await prisma.ivrDesign.findMany({
          where: {
            parentId: parent.id,
          },
        });

        const parentItemsKeys = childs?.map((child) => {
          return child.key;
        });

        const itemBindedWithSameKey = parentItemsKeys.includes(key);
        console.log("CHECKING BINDING ->", key);
        if (itemBindedWithSameKey) {
          console.log("YES IT INCLUDES");
          response.error(res, "Item already exists on same key");
          return;
        }
      }

      if (adminUser) {
        if (number) {
          const parent =
            parentId &&
            (await prisma.ivrDesign.findFirst({
              where: {
                parentId: parentId,
                isNumber: false,
              },
            }));
          if (parent) {
            response.error(res, "Keys bindings already exists!");
            return;
          }

          const newIvrDesign = await prisma.ivrDesign.create({
            data: {
              ivrCampaignId,
              createdBy: adminUser.id,
              parentId: parentId ? parentId : null,
              number,
              isNumber: true,
            },
          });

          response.success(res, "new ivr design created!", newIvrDesign);
        } else {
          const parent =
            parentId &&
            (await prisma.ivrDesign.findFirst({
              where: {
                parentId: parentId,
                isNumber: true,
              },
            }));

          if (parent) {
            response.error(res, "Number binding already exists!");
            return;
          }

          const newIvrDesign = await prisma.ivrDesign.create({
            data: {
              audioText,
              ivrCampaignId,
              key,
              createdBy: adminUser.id,
              parentId: parentId ? parentId : null,
              isNumber: false,
            },
          });

          response.success(res, "new ivr design created!", newIvrDesign);
        }
      } else {
        response.error(res, "User doesn't exist!");
      }
    } catch (error) {
      console.log("error while creating ivr design ->", error);
    }
  }

  // async designRemoveDelete(req, res) {
  //   try {
  //     const { designId } = req.params;

  //     console.log("IVR DESIGN API DELETE API CALLED");
  //     // finding campaign from campaignId
  //     const designFound = await prisma.ivrDesign.findFirst({
  //       where: {
  //         id: parseInt(designId),
  //       },
  //     });

  //     if (designFound) {
  //       if (!designFound.parentId) {
  //         const childs = await prisma.ivrDesign.findMany({
  //           where: {
  //             parentId: designFound.id,
  //           },
  //         });
  //       }

  //       response.success(res, "Design deleted successfully");
  //     } else {
  //       response.error(res, "Design does not exist!");
  //     }
  //   } catch (error) {
  //     console.log("error while deleting campaign ", error);
  //   }
  // }

  async designRemoveDelete(req, res) {
    try {
      const { designId } = req.params;

      console.log("DESIGN ID ->", designId);

      // finding campaign from campaignId
      const designFound = await prisma.ivrDesign.findFirst({
        where: {
          id: parseInt(designId),
        },
      });

      if (designFound) {
        // Initialize an array to store all child records
        let allChilds = [];

        // Fetch all child records recursively
        async function getAllChilds(parentId) {
          const childs = await prisma.ivrDesign.findMany({
            where: {
              parentId: parentId,
            },
          });

          for (const child of childs) {
            allChilds.push(child);
            await getAllChilds(child.id);
          }
        }

        await getAllChilds(designFound.id);

        const idOfChilds = allChilds.map((child) => child.id);

        const deletedChilds = await prisma.ivrDesign.deleteMany({
          where: {
            id: {
              in: idOfChilds,
            },
          },
        });

        const deletedParent = await prisma.ivrDesign.delete({
          where: {
            id: designFound.id,
          },
        });

        response.success(res, "Design deleted successfully", { deletedParent });
      } else {
        response.error(res, "Design does not exist!");
      }
    } catch (error) {
      console.log("error while deleting ivr design ", error);
    }
  }
}

module.exports = new DesignController();