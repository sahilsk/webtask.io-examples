var request = require('request@2.27.0');
var AWS = require('aws-sdk@2.5.3')
var UTILITY_NAME="EC2-Tag_Auditor";
var ALERT_TOPIC_ARN = null;


/**
 * Method: init_aws
 * Description: initialize aws client
 * 
 * @param(objects): creds: object containing webtask secrets
 */
function init_aws(creds){
    ALERT_TOPIC_ARN = creds['ALERT_TOPIC_ARN'];
    AWS.config = new AWS.Config({
        accessKeyId: creds['AWS_ACCESS_KEY_ID'], 
        secretAccessKey: creds['AWS_SECRET_ACCESS_KEY'], 
        region: creds['AWS_REGION']
    });
}


/*
 * Method: Subscribe
 * Description: Subscribe to aws topic
 *
 * @param(string: url): Endpoint to hit to confirm subscription
 * @param(callback): callback
 */
function subscribe(url, cb){
    request(url, cb);
}


/**
 * Method: dispatch_alert
 * Description: Send alert to sns if find any violation
 * 
 * @param( topic): secrts: aws sns topic arn
 *
 */
function dispatch_alert( payload, cb){
    var sns = new AWS.SNS();
    var message = payload.message;
    var message_html = 'Audit Violation \n';
    message_html += "----------------------\n\n";
    if( typeof payload.message === 'object'){
        payload.message.forEach(function(m){
            message_html += "=> " + m; + "\n"
        })
    }
    message_html += "\n\n Please do the needful to avoid a messy infrastructure !!!";

    var params = {
        Message: message_html,
        Subject: payload.subject,
        TopicArn: ALERT_TOPIC_ARN
    };
    sns.publish(params, cb);
}


/*
 * Method: audit_ec2_instance
 * Description: audit ec2 instance. currently supported only tags
 *
 * @params(string:instance-id): instance-id
 * @paramas(callback): callback
 *
 */
function audit_ec2_instance(instanceId, cb){
    var params = {
        InstanceIds:[instanceId]
    };
    var ec2 = new AWS.EC2();
    ec2.describeInstances(params, function(err, data) {
        if (err) {
            cb(err, err.stack);
        }else{
            if( data.Reservations.length === 0){
                cb(null);
            }
            var instance = data.Reservations[0].Instances[0];
            var res_1 = should_have_valid_tags(instance);
            if( res_1.status === "failure"){
                var payload = {
                    "message": res_1.errors,
        "subject": "[ACTION-REQUIRED] " + UTILITY_NAME + ": Tagging rules violation occurred"
                }
                dispatch_alert( payload, function(err, data){
                    cb(err, res_1.errors);
                });
            }else{
                cb(null, res_1);
            }
        }
    });

}


/**
 * Method: should_have_valid_tags
 * Description: check if instance tagging conform to standards
 *
 * @param(object): Instance
 * 
 * @output ({}): object { error: array[], status: ok|failure }
 *
 */
function should_have_valid_tags(instance, callback){
    var output = {
        "status": "ok"
    };
    var tags = instance.Tags;
    if( tags.length === 0){
        output = {
            "status": "failure",
            "errors": [ instance['InstanceId'] + ": Missing error and service tag"]
        }
        return output;
    }

    var errors = [];
    var hasName = tags.filter( function(o) { if( o.Key === "Name" ) { return o ; } });
    var hasService = tags.filter( function(o) { if( o.Key === "service" ) { return o ; } });
    if( hasName.length === 0){
        errors.push( instance['InstanceId'] + ": 'name' tag is missing");
    }
    if( hasService.length === 0){
        errors.push( instance['InstanceId'] + ": 'service' tag is missing");
    }
    if( errors.length > 0){
        output = {
            "status": "failure",
            "errors": errors
        }
    }
    return output;
}

/**
 ************ Main Entry function ************
 * *******************************************
 */
module.exports = function(context, cb) {
    var error = {};
    var payload =- {};

    try{
        payload = JSON.parse(context.body_raw);
    }
    catch(e){
        error = {
            "message": "unable to parse body" + context.body_raw
        }                
        cb(error); 
    }

    switch(payload.Type){

        case "SubscriptionConfirmation":
            subscribe(payload.SubscribeURL, function(err, res, body){
                if (!error && res.statusCode == 200) {
                    cb(null);
                }else{
                    error = {
                        "message":  err || body,
                "type": payload.Type
                    }
                    cb(error);
                }
            });
            break;

        case "Notification":
            var event = {};
            try{
                event = JSON.parse(payload.Message);
            }catch(e){
                error = {
                    "message": "error while parsing payload.event" + e
                }                
                cb(error); 
            }

            if( event.detail && event.detail['instance-id']){
                init_aws( context.data);
                audit_ec2_instance(event.detail['instance-id'], function(error, result){
                    cb(error, result);
                });

            }else{
                console.log( "Upsupported resource ---------------", event);
                error = {
                    "message": "unsupported resource",
                    "type": payload.Type,
                    "resource": event.detail,
                    "notification": event['detail-type']
                }
                cb(error);
            }
            break;

        default:
            error = {
                "message": "unsupported payload type: " + payload.Type
            }
            cb(error);
    }


}
