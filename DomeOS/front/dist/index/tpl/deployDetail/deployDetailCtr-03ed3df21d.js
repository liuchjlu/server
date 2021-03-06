domeApp.controller('DeployDetailCtr', ['$scope', '$domeDeploy', '$domeCluster', '$domePublic', '$state', '$modal', '$timeout', '$util', function ($scope, $domeDeploy, $domeCluster, $domePublic, $state, $modal, $timeout, $util) {
	'use strict';
	$scope.$emit('pageTitle', {
		title: '部署',
		descrition: '',
		mod: 'deployManage'
	});
	if (!$state.params.id) {
		$state.go('deployManage');
	}
	$scope.valid = {
		needValid: false
	};
	var deployId = +$state.params.id,
		clusterList = [],
		timeout, timeoutEvent, stateInfo;
	$scope.resourceType = 'DEPLOY';
	$scope.resourceId = deployId;
	$scope.tabActive = [{
		active: false
	}, {
		active: false
	}, {
		active: false
	}, {
		active: false
	}, {
		active: false
	}, {
		active: false
	}, {
		active: false
	}];

	$scope.labelKey = {
		key: ''
	};
	$scope.$on('memberPermisson', function (event, hasPermisson) {
		$scope.hasMemberPermisson = hasPermisson;
		if (!hasPermisson && stateInfo.indexOf('user') !== -1) {
			$state.go('deployDetail.detail');
			$scope.tabActive[0].active = true;
		}
	});
	var loadingsIns = $scope.loadingsIns = $domePublic.getLoadingInstance();
	var clusterService = $domeCluster.getInstance('ClusterService');

	function _formartProcessStatusArr(statusList) {
		var formartedStatus = [];
		if (!statusList || statusList.length === 0) {
			return [{
				version: '无状态',
				replicas: '0实例'
			}];
		}
		for (var i = 0; i < statusList.length; i++) {
			formartedStatus.push({
				version: 'version' + statusList[i].version,
				replicas: statusList[i].replicas + '实例'
			});
		}
		return formartedStatus;
	}
	var _formartEvent = function (event) {
		event.date = $util.getPageDate(event.startTime);
		event.primarySnapshot = _formartProcessStatusArr(event.primarySnapshot);
		event.targetSnapshot = _formartProcessStatusArr(event.targetSnapshot);
		event.currentSnapshot = _formartProcessStatusArr(event.currentSnapshot);
		switch (event.operation) {
		case 'UPDATE':
			event.optTxt = '升级';
			break;
		case 'ROLLBACK':
			event.optTxt = '回滚';
			break;
		case 'SCALE_UP':
			event.optTxt = '扩容';
			break;
		case 'SCALE_DOWN':
			event.optTxt = '缩容';
			break;
		case 'CREATE':
			event.optTxt = '创建';
			break;
		case 'START':
			event.optTxt = '启动';
			break;
		case 'STOP':
			event.optTxt = '停止';
			break;
		case 'DELETE':
			event.optTxt = '删除';
			break;
		case 'ABORT_UPDATE':
			event.optTxt = '中断升级';
			break;
		case 'ABORT_ROLLBACK':
			event.optTxt = '中断回滚';
			break;
		case 'ABORT_SCALE_UP':
			event.optTxt = '中断扩容';
			break;
		case 'ABORT_SCALE_DOWN':
			event.optTxt = '中断缩容';
			break;
		case 'ABORT_START':
			event.optTxt = '中断启动';
			break;
		case 'KUBERNETES':
			event.optTxt = '系统操作';
			event.eventStatus = 'KUBERNETES';
			break;
		}
		switch (event.eventStatus) {
		case 'START':
			event.statusTxt = '开始';
			break;
		case 'PROCESSING':
			event.statusTxt = '处理中';
			break;
		case 'SUCCESS':
			event.statusTxt = '成功';
			break;
		case 'FAILED':
			event.statusTxt = '失败';
			break;
		case 'ABORTED':
			event.statusTxt = '已中断';
			break;
		}
	};
	var freshEvents = function () {
		return $domeDeploy.deployService.getEvents(deployId).then(function (res) {
			var eventList = res.data.result || [],
				newCount = 0,
				isFind = false,
				i, j;
			if (!$scope.eventList || $scope.eventList.length === 0) {
				for (i = 0; i < eventList.length; i++) {
					_formartEvent(eventList[i]);
				}
				$scope.eventList = eventList;
				eventList = null;
				return true;
			}
			for (i = 0; i < eventList.length; i++) {
				_formartEvent(eventList[i]);
				isFind = false;
				for (j = newCount; j < $scope.eventList.length; j++) {
					if ($scope.eventList[j].eid === eventList[i].eid) {
						if ($scope.eventList[j].eventStatus === eventList[i].eventStatus) {
							$scope.eventList[j].date = $util.getPageDate($scope.eventList[j].startTime);
						} else {
							$.extend($scope.eventList[j], eventList[i]);
						}
						isFind = true;
						break;
					}
				}
				if (!isFind) {
					$scope.eventList.splice(newCount, 0, eventList[i]);
					newCount++;
				}
			}
			eventList = null;
			return true;
		}, function () {
			return true;
		});
	};
	$scope.getEvents = function () {
		if (!$scope.eventList) {
			freshEvents();
		}
		if (timeoutEvent) {
			$timeout.cancel(timeoutEvent);
		}
		timeoutEvent = $timeout(function () {
			freshEvents().finally(function () {
				if ($state.$current.name == 'deployDetail.event') {
					$scope.getEvents();
				}
			});
		}, 4000);
	};
	var getDeployInstance = function () {
		$domeDeploy.deployService.getInstances(deployId).then(function (res) {
			$scope.instanceList = res.data.result;
		});
	};

	function failedCb(res) {
		$domePublic.openWarning({
			title: '操作失败！',
			msg: res.data.resultMsg
		});
	}

	function freshDeploy() {
		if ($state.current.name.indexOf('deployDetail') !== -1) {
			$domeDeploy.deployService.getSingle(deployId).then(function (res) {
				if ($scope.deployIns) {
					$scope.deployIns.freshDeploy(res.data.result);
					$scope.deployEditIns.freshDeploy(res.data.result);
				}
			}).finally(function () {
				if (timeout) {
					$timeout.cancel(timeout);
				}
				timeout = $timeout(freshDeploy, 4000);
			});
		}
	}
	freshDeploy();

	var init = function () {
		loadingsIns.startLoading('fresh');
		freshEvents();
		getDeployInstance();
		$domeDeploy.deployService.getSingle(deployId).then(function (res) {
			var data = res.data.result;
			$scope.$emit('pageTitle', {
				title: data.deployName,
				descrition: data.serviceDnsName,
				mod: 'deployManage'
			});
			$scope.deployIns = $domeDeploy.getInstance('Deploy', angular.copy(res.data.result));
			$scope.config = $scope.deployIns.config;
			// 初始化clusterlist
			$scope.deployIns.clusterListIns.init(angular.copy(clusterList));
			// 选择当前version的cluster
			$scope.deployIns.toggleCluster();

			$scope.deployEditIns = $domeDeploy.getInstance('Deploy', angular.copy(res.data.result));
			$scope.editConfig = $scope.deployEditIns.config;
			$scope.deployEditIns.clusterListIns.init(angular.copy(clusterList));
			$scope.deployEditIns.toggleCluster();

			$scope.showdeploy = angular.copy(data);
			if ($scope.showdeploy.networkMode === 'HOST') {
				$scope.showdeploy.serviceDnsName = 'Host网络下没有内网域名';
				if ($scope.showdeploy.exposePortNum !== 0) {
					$scope.showdeploy.visitSet = '允许访问';
				} else {
					$scope.showdeploy.visitSet = '禁止访问';
				}

			} else {
				if ($scope.showdeploy.loadBalanceDrafts && $scope.showdeploy.loadBalanceDrafts.length !== 0) {
					$scope.showdeploy.visitSet = '对外服务开启';
				} else if ($scope.showdeploy.innerServiceDrafts && $scope.showdeploy.innerServiceDrafts.length !== 0) {
					$scope.showdeploy.visitSet = '对内服务开启';
				} else {
					$scope.showdeploy.visitSet = '禁止访问';
					$scope.showdeploy.serviceDnsName = '未开启访问设置，不提供内网域名';
				}
			}
		}, function () {
			$domePublic.openWarning('请求失败！');
			$state.go('deployManage');
		}).finally(function () {
			loadingsIns.finishLoading('fresh');
			loadingsIns.finishLoading('init');
		});
	};
	loadingsIns.startLoading('init');

	clusterService.getData().then(function (res) {
		clusterList = res.data.result || [];
		init();
	});
	$scope.labelKeyDown = function (event, str, labelsInfoFiltered) {
		var lastSelectLabelKey;
		var labelsInfo = $scope.deployEditIns.nodeListIns.labelsInfo;
		var hasSelected = false;
		if (event.keyCode == 13 && labelsInfoFiltered) {
			angular.forEach(labelsInfoFiltered, function (value, label) {
				if (!hasSelected && !value.isSelected) {
					$scope.deployEditIns.nodeListIns.toggleLabel(label, true);
					$scope.labelKey.key = '';
				}
				hasSelected = true;
			});
		} else if (!str && event.keyCode == 8) {
			angular.forEach(labelsInfo, function (value, key) {
				if (value.isSelected) {
					lastSelectLabelKey = key;
				}
			});
			if (lastSelectLabelKey) {
				$scope.deployEditIns.nodeListIns.toggleLabel(lastSelectLabelKey, false);
			}
		}
	};
	$scope.toggleVersion = function (versionId) {
		$scope.deployIns.toggleVersion(versionId);
	};
	$scope.recover = function () {
		$scope.isWaitingRecover = true;
		$scope.deployIns.recoverVersion().then(function () {
			$domePublic.openPrompt('已提交，正在恢复。');
			init();
		}, function (res) {
			if (res != 'dismiss') {
				$domePublic.openWarning('恢复失败！');
			}
		}).finally(function () {
			$scope.isWaitingRecover = false;
		});
	};
	$scope.startVersion = function () {
		$scope.isWaitingStart = true;
		$scope.deployIns.startVersion().then(function () {
			init();
		}, function (res) {
			if (res != 'dismiss') {
				$domePublic.openWarning('启动失败！');
			}
		}).finally(function () {
			$scope.isWaitingStart = false;
		});
	};
	$scope.stopVersion = function () {
		$scope.isWaitingStop = true;
		$scope.deployIns.stop().then(function () {
			$domePublic.openPrompt('已发送，正在停止！');
			init();
		}, function () {
			$domePublic.openWarning('停止失败！');
		}).finally(function () {
			$scope.isWaitingStop = false;
		});
	};
	$scope.showLog = function (instanceName, containers) {
		$modal.open({
			templateUrl: 'index/tpl/modal/instanceLogModal/instanceLogModal.html',
			controller: 'InstanceLogModalCtr',
			size: 'md',
			resolve: {
				instanceInfo: function () {
					return {
						clusterId: $scope.deployIns.config.clusterId,
						namespace: $scope.deployIns.config.namespace,
						instanceName: instanceName,
						containers: containers
					};
				}
			}
		});
	};
	$scope.toUpdate = function () {
		if ($scope.editConfig.containerDrafts.length === 0) {
			$domePublic.openWarning('请至少选择一个镜像！');
		} else {
			$scope.isWaitingUpdate = true;
			$scope.valid.needValid = false;
			$scope.deployEditIns.createVersion().then(function (msg) {
				$scope.deployIns.freshVersionList();
				if (msg == 'update') {
					init();
				}
			}).finally(function () {
				$scope.isWaitingUpdate = false;
			});
		}
	};
	$scope.scaleVersion = function () {
		$scope.isWaitingScale = true;
		$scope.deployIns.scale().then(function () {
			init();
		}).finally(function () {
			$scope.isWaitingScale = false;
		});
	};
	$scope.updateVersion = function () {
		$scope.isWaitingUpVersion = true;
		$scope.deployIns.updateVersion().then(function () {
			init();
		}, function (res) {
			if (res != 'dismiss') {
				$domePublic.openWarning('升级失败！');
			}
		}).finally(function () {
			$scope.isWaitingUpVersion = false;
		});
	};
	$scope.abortDeploy = function (status) {
		$scope.isWaitingOperation = true;
		var promptTxt = '';
		switch (status) {
		case 'DEPLOYING':
			promptTxt = '中断启动，部署会处于停止状态，是否继续？';
			break;
		case 'UPDATING':
			promptTxt = '中断升级，部署可能出现两个运行中的版本，是否继续？';
			break;
		case 'BACKROLLING':
			promptTxt = '中断回滚，部署可能出现两个运行中的版本，是否继续？';
			break;
		case 'UPSCALING':
			promptTxt = '中断扩容，部署实例数会处于中断时的个数，是否继续？';
			break;
		case 'DOWNSCALING':
			promptTxt = '中断缩容，部署实例数会处于中断时的个数，是否继续？';
			break;
		}
		$domePublic.openConfirm(promptTxt).then(function () {
			$scope.deployIns.abort().then(function () {
				init();
			}, failedCb).finally(function () {
				$scope.isWaitingOperation = false;
			});
		}, function () {
			$scope.isWaitingOperation = false;
		});
	};
	$scope.deleteDeploy = function () {
		$domePublic.openDelete().then(function () {
			$scope.deployIns.delete().then(function () {
				$domePublic.openPrompt('删除成功！');
				$state.go('deployManage');
			}, failedCb);
		});
	};
	$scope.toConsole = function (index) {
		$modal.open({
			templateUrl: 'index/tpl/modal/selectContainerModal/selectContainerModal.html',
			controller: 'SelectContainerModalCtr',
			size: 'md',
			resolve: {
				info: function () {
					return {
						containerList: $scope.instanceList[index].containers,
						hostIp: $scope.instanceList[index].hostIp,
						resourceId: deployId,
						type: 'DEPLOY'
					};
				}
			}
		});
	};

	stateInfo = $state.$current.name;
	if (stateInfo.indexOf('update') !== -1) {
		$scope.tabActive[1].active = true;
	} else if (stateInfo.indexOf('event') !== -1) {
		$scope.tabActive[2].active = true;
		$scope.getEvents();
	} else if (stateInfo.indexOf('instance') !== -1) {
		$scope.tabActive[3].active = true;
	} else if (stateInfo.indexOf('network') !== -1) {
		$scope.tabActive[4].active = true;
	} else if (stateInfo.indexOf('user') !== -1) {
		$scope.tabActive[5].active = true;
	} else {
		$scope.tabActive[0].active = true;
	}
	$scope.$on('$destroy', function () {
		if (timeout) {
			$timeout.cancel(timeout);
		}
		if (timeoutEvent) {
			$timeout.cancel(timeoutEvent);
		}
	});
}]).controller('VersionListModalCtr', ['$scope', '$domeDeploy', 'deployInfo', '$modalInstance', function ($scope, $domeDeploy, deployInfo, $modalInstance) {
	var deployId = deployInfo.deployId;
	$scope.stateful = deployInfo.stateful;
	$scope.versionData = {
		replicas: deployInfo.defaultReplicas
	};
	$domeDeploy.deployService.getVersions(deployId).then(function (res) {
		$scope.versionList = res.data.result || [];
		if ($scope.versionList[0]) {
			$scope.checkVersion($scope.versionList[0].version);
		}
	});
	$scope.checkVersion = function (version) {
		$scope.versionData.versionId = version;
	};
	$scope.submit = function () {
		if ($scope.stateful) {
			delete $scope.versionData.replicas;
		}
		$modalInstance.close($scope.versionData);
	};
}]).controller('ScaleModalCtr', ['$scope', 'oldReplicas', '$modalInstance', function ($scope, oldReplicas, $modalInstance) {
	$scope.oldReplicas = oldReplicas;
	$scope.submitScale = function () {
		$modalInstance.close($scope.replicas);
	};
}]);