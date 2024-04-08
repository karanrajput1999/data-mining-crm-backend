const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const response = require("../utils/response");
const getToken = require("../utils/getToken");
class CampaignController {
  async campaignCreatePost(req, res) {
    try {
      const { campaignName, campaignDescription, campaignType } = req.body;

      const token = await getToken(req, res);

      // admin that is creating the user
      const adminUser = await prisma.user.findFirst({
        where: {
          token: parseInt(token),
        },
      });

      const alreadyExists = await prisma.campaign.findFirst({
        where: {
          adminId: adminUser.id,
          campaignName,
        },
      });

      if (alreadyExists) {
        response.error(
          res,
          "Campaign with same name already exists!",
          alreadyExists
        );
      } else {
        const newCampaign = await prisma.campaign.create({
          data: {
            campaignName,
            campaignDescription,
            campaignType,
            adminId: adminUser.id,
          },
        });

        response.success(res, "new campaign created!", newCampaign);
      }
    } catch (error) {
      console.log("error while creating campaign ->", error);
    }
  }

  async campaignUpdatePatch(req, res) {
    try {
      const { campaignName, campaignDescription, campaignType } = req.body;
      const { campaignId } = req.params;

      const token = await getToken(req, res);

      // admin that is creating the campaign
      const adminUser = await prisma.user.findFirst({
        where: {
          token: parseInt(token),
        },
      });

      // finding campaign from id
      const campaignFound = await prisma.campaign.findFirst({
        where: {
          id: parseInt(campaignId),
        },
      });

      const alreadyExists = await prisma.campaign.findFirst({
        where: {
          adminId: adminUser.id,
          campaignName,
        },
      });

      if (campaignFound) {
        if (alreadyExists) {
          response.error(
            res,
            "Campaign with same name already exists!",
            alreadyExists
          );
        } else {
          const updatedCampaign = await prisma.campaign.update({
            where: {
              id: parseInt(campaignId),
            },
            data: {
              campaignName,
              campaignDescription,
              campaignType,
            },
          });

          response.success(res, "Campaign updated successfully", {
            updatedCampaign,
          });
        }
      } else {
        response.error(res, "Campaign not found!");
      }
    } catch (error) {
      console.log("error while updating campaign ", error);
    }
  }
  async campaignRemoveDelete(req, res) {
    try {
      const { campaignId } = req.params;

      // finding campaign from campaignId
      const campaignFound = await prisma.campaign.findFirst({
        where: {
          id: parseInt(campaignId),
        },
      });

      if (campaignFound) {
        const deletedCampaign = await prisma.campaign.delete({
          where: {
            id: parseInt(campaignId),
          },
        });

        response.success(res, "Campaign deleted successfully!", {
          deletedCampaign,
        });
      } else {
        response.error(res, "Campaign does not exist!");
      }
    } catch (error) {
      console.log("error while deleting campaign ", error);
    }
  }
}

module.exports = new CampaignController();
